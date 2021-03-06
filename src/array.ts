import { def, ReactiveFlags, addProp, handleReadonly, toReactive, toReadonly, toShallow } from './util'
import {
  ITERATE_KEY,
  toRaw,
  trigger,
  isReactive,
  TriggerOpTypes,
  isReadonly,
  isProxy,
  track,
  TrackOpTypes,
  pauseTracking,
  enableTracking
} from '@vue/reactivity'
// clone https://github.com/vuejs/vue/blob/dev/src/core/observer/array.js
const arrayProto: any = Array.prototype
// const methods = Object.getOwnPropertyNames(arrayProto)
const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

// hook API
// methods.forEach(method => {
//   if (methodsToPatch.includes(method)) {
//     return
//   }
//   const original = arrayProto[method]
//   def(arrayMethods, method, {
//     writable: true,
//     value: function mutator (...args: any[]) {
//       // const target = toRaw(this) as any
//       debugger
//       const result = original.apply(this, args)
//       return result
//     }
//   })
// })

methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, {
    writable: true,
    value: function mutator (...args: any[]) {
      const target = toRaw(this) as any
      const proxy = isProxy(this) ? this : (target[ReactiveFlags.REACTIVE] || target[ReactiveFlags.READONLY])
      if (handleReadonly(proxy, method)) {
        return
      }
      // fix https://github.com/vuejs/vue-next/issues/2137
      pauseTracking()
      const oldThis = target.slice()
      const oldLen = oldThis.length
      const result = original.apply(target, args)
      enableTracking()
      const newLen = target.length
      let i = 0
      let j = 0
      while (i < newLen || j < oldLen) {
        if (i < newLen) {
          // update
          const oldVal = oldThis[i]
          const newVal = target[i]
          if (!(i in oldThis)) {
            // set
            addProp(proxy, i, newVal)
          } else {
            if (oldVal !== newVal) {
              trigger(target, 'set' as TriggerOpTypes, i, newVal, oldVal)
            }
          }
        } else {
          delete proxy[i]
          proxy.length -= 1
          // delete old
          trigger(target, 'delete' as TriggerOpTypes, i, undefined, oldThis[i])
        }
        i++
        j++
      }
      // if (oldLen !== newLen) {
      //   // length changed
      //   trigger(target, 'set' as TriggerOpTypes, 'length', target.length, oldLen)
      // }
      // always trigger clear to hack trigger all effects
      trigger(target, 'clear' as TriggerOpTypes, 'length', target.length, oldLen)
      return result
    }
  })
})

const method = 'forEach'
const _forEach = arrayProto[method]
def(arrayMethods, method, {
  writable: true,
  value: function mutator (callback: Function, thisArg: unknown) {
    const target = toRaw(this) as any
    const _isReadonly = isReadonly(this)
    const _isReactive = isReactive(this)
    const proxy = (_isReadonly || _isReactive) ? this : (target[ReactiveFlags.REACTIVE] || target[ReactiveFlags.READONLY])

    !_isReadonly && track(target, 'iterate' as TrackOpTypes, ITERATE_KEY)
    const wrap = _isReadonly ? toReadonly : _isReactive ? toReactive : toShallow
    function wrappedCallback(value: unknown, key: number) {
        return callback.call(thisArg, wrap(value), key, proxy)
    }
    return _forEach.call(target, wrappedCallback)
  }
})

export {
  arrayMethods
}
