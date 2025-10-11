

const renderHelper = (selector, renderFn, renderNow = false) => {

  async function render(fnOrStr) {
    const elements = document.querySelectorAll(selector)
    for (const element of elements) {
      element.innerHTML = (fnOrStr instanceof Function) ? fnOrStr() : fnOrStr
    }
  }

  console.log({selector, renderFn})
  if (!renderFn) return render
  else {
    if (renderNow) render(renderFn)
    return render.bind(null, renderFn)
  }
}

export default renderHelper

export {
  renderHelper
}
