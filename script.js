const TOAST_NOTIFICATION_TIMEOUT = 4 * 1000;

let smiElement, toastsContainer;

function chrome_ios_dialog_override() {
  if (!navigator.userAgent.includes('CriOS')) return;
  const override = document.createElement('style');
  override.setAttribute('type', 'text/css');
  override.innerText = `og-smi dialog {
  position: fixed !important;
  top: 50%;
  transform: translateY(-50%);
}
`;
  document.head.appendChild(override);
}

function html5_dialog_polyfill() {
  if (document.createElement('dialog').showModal) return;

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dialog-polyfill/0.5.6/dialog-polyfill.min.js';
  script.onload = () => {
    const dialogPolyfill = window.dialogPolyfill;
    smiElement.querySelectorAll('dialog').forEach(dialogPolyfill.registerDialog);

    const observer = new MutationObserver(mutationsList => {
      mutationsList.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(addedNode => {
            if (addedNode.tagName === 'DIALOG') {
              dialogPolyfill.registerDialog(addedNode);
            } else if (addedNode.nodeType === 1) {
              const dialogs = addedNode.querySelectorAll('dialog');

              dialogs.forEach(dialog => dialogPolyfill.registerDialog(dialog));
            }
          });
        }
      });
    });
    observer.observe(smiElement, { subtree: true, childList: true });
  };
  document.head.appendChild(script);

  const ua = navigator.userAgent.toLowerCase();
  const isSafari = ua.includes('safari') && !(ua.includes('chrome') || ua.includes('chromium'));
  if (isSafari) {
    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/dialog-polyfill/0.5.6/dialog-polyfill.min.css';

    document.head.appendChild(link);
  }
}

(function safari_request_submit_polyfill(prototype) {
  if (typeof prototype.requestSubmit === 'function') return;

  function raise(errorConstructor, message, name) {
    throw new errorConstructor(`Failed to execute 'requestSubmit' on 'HTMLFormElement': ${message}.`, name);
  }

  function validateSubmitter(submitter, form) {
    submitter instanceof HTMLElement || raise(TypeError, "parameter 1 is not of type 'HTMLElement'");
    submitter.type === 'submit' || raise(TypeError, 'The specified element is not a submit button');
    submitter.form === form ||
      raise(DOMException, 'The specified element is not owned by this form element', 'NotFoundError');
  }

  prototype.requestSubmit = function(submitter) {
    if (submitter) {
      validateSubmitter(submitter, this);
      submitter.click();
    } else {
      const sbm = document.createElement('input');
      sbm.type = 'submit';
      sbm.hidden = true;
      this.appendChild(sbm);
      sbm.click();
      this.removeChild(sbm);
    }
  };
})(HTMLFormElement.prototype);

function show_closest_modal(ev) {
  const dialog = ev.target.parentNode.querySelector('dialog');
  dialog.showModal();
  dialog.appendChild(toastsContainer);
}

function close_closest_modal(ev) {
  const dialog = ev.target.closest('dialog');
  dialog.close();
  smiElement.appendChild(toastsContainer);
}

function toast_notification_animation() {
  function setupToasts() {
    const observer = new MutationObserver(mutationsList => {
      mutationsList.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          setTimeout(() => {
            node.classList.add('og-show');
          }, 1);
          setTimeout(() => {
            node.addEventListener('transitionend', () => {
              node.classList.add('og-hide');
            });
            node.classList.remove('og-show');
          }, TOAST_NOTIFICATION_TIMEOUT);
        });
      });
    });
    observer.observe(toastsContainer, { childList: true });
  }

  if (smiElement.querySelector('.og-toasts')) {
    toastsContainer = smiElement.querySelector('.og-toasts');
    setupToasts();
  } else {
    const observer = new MutationObserver(mutationsList => {
      mutationsList.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches('.og-toasts')) {
            toastsContainer = node;
            setupToasts();
            observer.disconnect();
          }
        });
      });
    });
    observer.observe(smiElement, { subtree: true, childList: true });
  }
}

function disable_form_elements(ev) {
  ev.target.querySelectorAll('select,input,button').forEach(it => it.toggleAttribute('disabled', true));
}

function enable_form_elements(ev) {
  ev.target.querySelectorAll('select,input,button').forEach(it => it.toggleAttribute('disabled', false));
}

function submit_form_onchange(ev) {
  ev.target.closest('form').requestSubmit();
}

function nth_order_date(order, subscription, n = 1) {
  const increment = subscription.every * n;
  const unit = {
    '1': 'day',
    '2': 'week',
    '3': 'month'
  }[subscription.every_period];

  const dayjs = ((window.og || {}).smi || {}).dayjs;

  return typeof dayjs === 'function' ? dayjs(order.place).add(increment, unit) : null;
}

function bootstrap_flyout_menu() {
  const toggle = (el, force) => {
    const opened = force === undefined ? el.getAttribute('flyout-menu-toggle') === 'opened' : !force;
    el.setAttribute('flyout-menu-toggle', opened ? 'closed' : 'opened');
  };

  document.addEventListener('click', evt => {
    const toggler = evt.target.closest('[flyout-menu-toggle="opened"]');
    if (toggler && smiElement.contains(toggler)) return false;
    return smiElement.querySelectorAll('[flyout-menu-toggle]').forEach(el => toggle(el, false));
  });

  const register = function(el) {
    el.addEventListener('click', function(ev) {
      return el.contains(ev.target.closest('dialog')) ? false : toggle(el);
    });
  };

  const observer = new MutationObserver(mutationsList => {
    mutationsList
      .filter(mutation => mutation.type === 'childList')
      .forEach(mutation => {
        mutation.addedNodes.forEach(addedNode => {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            if (addedNode.matches('[flyout-menu-toggle]')) {
              register(addedNode);
            } else {
              addedNode.querySelectorAll('[flyout-menu-toggle]').forEach(el => register(el));
            }
          }
        });
      });
  });
  observer.observe(smiElement, { subtree: true, childList: true });
}

function bootstrap(el) {
  smiElement = el;
  bootstrap_flyout_menu();
  chrome_ios_dialog_override();
  html5_dialog_polyfill();
  toast_notification_animation();
}

if (document.querySelector('#og-msi,og-smi')) {
  bootstrap(document.querySelector('#og-msi,og-smi'));
} else {
  document.addEventListener('og:smi:ready', ev => {
    bootstrap(ev.target);
  });
}
