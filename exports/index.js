/**
 * @typedef {HTMLElement | Document | ShadowRoot} Container
 */

/**
 * Allow shallow queries to be appended to the default options of DOM testing library
 * @typedef {object} ShadowOptions
 * @property {number} ShadowOptions.depth
 */

/**
 * @template {HTMLElement} T
 * @param {Container} container
 * @param {string} selector
 * @param {ShadowOptions} [options={ depth: Infinity }]
 * @returns {T | null}
 */
export function deepQuerySelector(
  container,
  selector,
  options = { depth: Infinity },
) {
  const els = deepQuerySelectorAll(container, selector, options);

  if (Array.isArray(els) && els.length > 0) {
    return /** @type {T | null} */ (els[0])
  }

  return null;
}

/**
 * `deepQuerySelector` behaves like a normal querySelector except it will recurse into the container ShadowRoot
 * and shadowRoot of children. It will not return shadow roots.
 *
 * @example
 *   // <my-element>
 *   //   #shadowRoot <slot name="blah"></slot>
 *   //   <div></div>
 *   // </my-element>
 *   deepQuerySelectorAll(myElement, "*") // => [slot, div]
 *   deepQuerySelectorAll(myElement, "slot[name='blah']") // => [slot]
 * @template {HTMLElement} T
 * @param {Container} container
 * @param {string} selector
 * @param {ShadowOptions} [options={ depth: Infinity }]
 * @returns {T[]}
 */
export function deepQuerySelectorAll(
  container,
  selector,
  options = { depth: Infinity },
) {
  const elements = getAllElementsAndShadowRoots(container, options);

  const queriedElements = elements
    .map((el) => Array.from(/** @type {NodeListOf<T>} */ (el.querySelectorAll(selector))))
    .flat(Infinity);
  return [...new Set(/** @type {T[]} */ (queriedElements))];
}

// This could probably get really slow and memory intensive in large DOMs,
// maybe an infinite generator in the future?
/**
 * @param {*} container
 * @param {ShadowOptions} [options={ depth: Infinity }]
 */
export function getAllElementsAndShadowRoots(
  container,
  options = { depth: Infinity },
) {
  const selector = "*";
  return recurse(container, selector, options);
}

/**
 * @param {Container} container
 * @param {string} selector
 * @param {ShadowOptions} [options={ depth: Infinity }]
 * @param {(Element | ShadowRoot | Document)[]} [elementsToProcess=[]]
 * @param {(Element | ShadowRoot | Document)[]} [elements=[]]
 * @param {number} [currentDepth=1]
 */
function recurse(
  container,
  selector,
  options = { depth: Infinity },
  elementsToProcess = [],
  elements = [],
  currentDepth = 1,
) {

  // if "document" is passed in, it will also pick up "<html>" causing the query to run twice.
  if (container instanceof Document) {
    container = document.documentElement;
  }

  // I haven't figured this one out, but for some reason when using the buildQueries
  // from DOM-testing-library, not reassigning here causes an infinite loop.
  // I've even tried calling "elementsToProcess.includes / .find" with no luck.
  elementsToProcess = [container];
  elements.push(container); // Make sure we're checking the container element!

  // Accounts for if the container houses a textNode
  if (
    container instanceof HTMLElement &&
    container.shadowRoot != null &&
    container.shadowRoot.mode !== "closed"
  ) {
    elements.push(container.shadowRoot);
    elementsToProcess.push(container.shadowRoot);
  }

  elementsToProcess.forEach((containerElement) => {
    containerElement
      .querySelectorAll(selector)
      .forEach((el) => {
        if (el.shadowRoot == null || el.shadowRoot.mode === "closed") {
          elements.push(el);
          return;
        }

        // This is here because queryByRole() requires the parent element which in some cases is the shadow root.
        elements.push(el.shadowRoot);

        if (options.depth <= currentDepth) {
          el.shadowRoot.querySelectorAll(selector).forEach((el) => {
            elements.push(el);
          });
          return;
        }

        el.shadowRoot.querySelectorAll(selector).forEach((el) => {
          elements.push(el);
          elementsToProcess.push(el);
        });
        recurse(el.shadowRoot, selector, options, elementsToProcess, elements, currentDepth);
      });
  });

  // We can sometimes hit duplicate nodes this way, lets stop that.
  return [...new Set(elements)];
}
