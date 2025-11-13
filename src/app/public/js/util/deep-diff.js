export default function deepDiff(obj1, obj2) {
  const differences = {}

  // Check for differences in obj1 properties
  for (const key in obj1) {
    if (Object.prototype.hasOwnProperty.call(obj1, key)) {
      if (!Object.prototype.hasOwnProperty.call(obj2, key)) {
        differences[key] = {
          oldValue: obj1[key],
          newValue: undefined,
          status: 'deleted'
        }
      } else if (typeof obj1[key] === 'object' && obj1[key] !== null && typeof obj2[key] === 'object' && obj2[key] !== null) {
        const nestedDiff = deepDiff(obj1[key], obj2[key])
        if (Object.keys(nestedDiff).length > 0) {
          differences[key] = nestedDiff
        }
      } else if (obj1[key] !== obj2[key]) {
        differences[key] = {
          oldValue: obj1[key],
          newValue: obj2[key],
          status: 'modified'
        }
      }
    }
  }

  // Check for new properties in obj2
  for (const key in obj2) {
    if (Object.prototype.hasOwnProperty.call(obj2, key)) {
      if (!Object.prototype.hasOwnProperty.call(obj1, key)) {
        differences[key] = {
          oldValue: undefined,
          newValue: obj2[key],
          status: 'added'
        }
      }
    }
  }

  return differences
}
