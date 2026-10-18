/*
 * Chat do site (ADR 0012). Servido pela API em /v1/public/chat/widget.js e
 * colado no site assim:
 *
 *   <script src="https://API/v1/public/chat/widget.js" data-key="CHAVE" async></script>
 *
 * Sem dependências e sem build: roda em qualquer site. Fica num Shadow DOM
 * (o CSS do site não o afeta, nem o dele o site), e todo texto entra como
 * texto (textContent), nunca como HTML. O token do visitante fica no
 * localStorage do site; sem localStorage (navegação privada, iframe), a
 * conversa vale só enquanto a página estiver aberta.
 *
 * `data-preview="1"` (prévia do editor de sites): mostra o widget, sem
 * identificar nem enviar nada.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || window.__omniChatLoaded) return;
  window.__omniChatLoaded = true;

  var KEY = script.getAttribute('data-key') || '';
  var PREVIEW = script.getAttribute('data-preview') === '1';
  var API = script.src.replace(/\/v1\/public\/chat\/widget\.js.*$/, '');
  var STORAGE_KEY = 'omniChat:' + KEY;

  var state = {
    config: null,
    session: null, // { token, name, expiresAt }
    messages: [], // { id?, clientId?, direction, text, sentAt, pending?, failed? }
    open: false,
    unread: 0,
    socket: null,
    poller: null,
  };

  // ── armazenamento (pode não existir) ─────────────────────────────────────
  function loadSession() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var session = raw ? JSON.parse(raw) : null;
      if (session && new Date(session.expiresAt).getTime() > Date.now()) return session;
    } catch (e) {
      /* sem localStorage: sessão só em memória */
    }
    return null;
  }
  function saveSession(session) {
    state.session = session;
    try {
      if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* idem */
    }
  }

  // ── API ──────────────────────────────────────────────────────────────────
  function request(method, path, body, withToken) {
    var headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (withToken && state.session) headers.Authorization = 'Bearer ' + state.session.token;
    return fetch(API + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    }).then(function (response) {
      if (response.status === 401 && withToken) {
        // Token vencido ou de chave trocada: pede os dados de novo.
        saveSession(null);
        disconnectSocket();
        render();
      }
      return response
        .json()
        .catch(function () {
          return null;
        })
        .then(function (data) {
          if (!response.ok) {
            var error = new Error((data && data.code) || 'HTTP_' + response.status);
            error.code = data && data.code;
            throw error;
          }
          return data;
        });
    });
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  // ── mensagens ────────────────────────────────────────────────────────────
  function refreshMessages() {
    if (!state.session) return Promise.resolve();
    return request('GET', '/v1/public/chat/messages', null, true)
      .then(function (server) {
        if (!server) return;
        var known = {};
        server.forEach(function (m) {
          if (m.clientId) known[m.clientId] = true;
        });
        // As do visitante que o servidor ainda não gravou continuam na tela.
        var local = state.messages.filter(function (m) {
          return m.clientId && !known[m.clientId] && (m.pending || m.failed || !m.id);
        });
        var before = state.messages.filter(function (m) {
          return m.direction === 'outbound';
        }).length;
        state.messages = server.concat(local);
        var after = server.filter(function (m) {
          return m.direction === 'outbound';
        }).length;
        if (!state.open && after > before) state.unread += after - before;
        render();
      })
      .catch(function () {
        /* tenta de novo no próximo aviso */
      });
  }

  function sendMessage(text, retryOf) {
    var message = retryOf || {
      clientId: uuid(),
      direction: 'inbound',
      text: text,
      sentAt: new Date().toISOString(),
    };
    message.pending = true;
    message.failed = false;
    if (!retryOf) state.messages.push(message);
    render();
    request('POST', '/v1/public/chat/messages', { id: message.clientId, text: message.text }, true)
      .then(function () {
        message.pending = false;
        render();
      })
      .catch(function (error) {
        message.pending = false;
        message.failed = true;
        if (error.code === 'CHANNEL_NOT_CONNECTED' || error.code === 'WEB_CHAT_UNAVAILABLE') {
          message.error = 'O chat está fechado agora. Tente pelo WhatsApp ou e-mail.';
        }
        render();
      });
  }

  // ── tempo real (Socket.IO servido pela própria API) ──────────────────────
  var ioPromise = null;
  function loadSocketClient() {
    if (ioPromise) return ioPromise;
    ioPromise = new Promise(function (resolve, reject) {
      var previous = window.io;
      var tag = document.createElement('script');
      tag.src = API + '/socket.io/socket.io.min.js';
      tag.async = true;
      tag.onload = function () {
        var ours = window.io;
        // Não sobrescreve um Socket.IO que o site já use.
        if (previous) window.io = previous;
        else {
          try {
            delete window.io;
          } catch (e) {
            window.io = undefined;
          }
        }
        if (ours) resolve(ours);
        else reject(new Error('socket.io'));
      };
      tag.onerror = reject;
      document.head.appendChild(tag);
    });
    return ioPromise;
  }

  function connectSocket() {
    if (state.socket || !state.session || PREVIEW) return;
    loadSocketClient()
      .then(function (io) {
        if (state.socket || !state.session) return;
        var url = new URL(API);
        var path = url.pathname.replace(/\/$/, '') + '/socket.io';
        state.socket = io(url.origin + '/chat', {
          path: path,
          transports: ['websocket'],
          auth: { token: state.session.token },
        });
        state.socket.on('connect', refreshMessages);
        state.socket.on('chat.message', refreshMessages);
        state.socket.on('connect_error', function (error) {
          if (error && error.message === 'unauthorized') {
            saveSession(null);
            disconnectSocket();
            render();
          }
        });
        stopPolling();
      })
      .catch(startPolling); // sem WebSocket: consulta a cada 5 s com o chat aberto
  }
  function disconnectSocket() {
    if (state.socket) state.socket.disconnect();
    state.socket = null;
    stopPolling();
  }
  function startPolling() {
    stopPolling();
    state.poller = setInterval(function () {
      if (state.open) refreshMessages();
    }, 5000);
  }
  function stopPolling() {
    if (state.poller) clearInterval(state.poller);
    state.poller = null;
  }

  // ── interface ────────────────────────────────────────────────────────────
  var host = document.createElement('div');
  host.setAttribute('data-omni-chat', '');
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      if (name === 'text') node.textContent = attrs[name];
      else if (name.slice(0, 2) === 'on') node.addEventListener(name.slice(2), attrs[name]);
      else if (attrs[name] !== false && attrs[name] != null) node.setAttribute(name, attrs[name]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function contrastOn(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111111' : '#ffffff';
  }

  function styles(color) {
    var on = contrastOn(color);
    return (
      ':host{all:initial}' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '.launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:' +
      color +
      ';color:' +
      on +
      ';box-shadow:0 6px 24px rgba(0,0,0,.25);display:grid;place-items:center}' +
      '.launcher svg{width:28px;height:28px;fill:currentColor}' +
      '.badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#e11d48;color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center}' +
      '.panel{position:fixed;right:20px;bottom:92px;z-index:2147483000;width:360px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 120px);background:#fff;color:#1f2328;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;font-size:15px;line-height:1.4}' +
      '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}}' +
      '.head{background:' +
      color +
      ';color:' +
      on +
      ';padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
      '.head strong{font-size:16px}' +
      '.close{background:transparent;border:0;color:inherit;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}' +
      '.body{flex:1;overflow-y:auto;padding:14px;background:#f5f6f8;display:flex;flex-direction:column;gap:8px}' +
      '.msg{max-width:82%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}' +
      '.in{align-self:flex-end;background:' +
      color +
      ';color:' +
      on +
      ';border-bottom-right-radius:4px}' +
      '.out{align-self:flex-start;background:#fff;border:1px solid #e3e6eb;border-bottom-left-radius:4px}' +
      '.meta{font-size:11px;opacity:.75;margin-top:3px}' +
      '.failed{opacity:.6}' +
      '.retry{background:none;border:0;color:#e11d48;font-size:12px;cursor:pointer;padding:0;text-decoration:underline;align-self:flex-end}' +
      '.foot{border-top:1px solid #e3e6eb;padding:10px;display:flex;gap:8px;background:#fff}' +
      'textarea,input{font:inherit;border:1px solid #cfd4dc;border-radius:10px;padding:10px;width:100%;color:#1f2328;background:#fff}' +
      'textarea{resize:none;height:44px}' +
      '.send,.start{border:0;border-radius:10px;padding:0 16px;font:inherit;font-weight:600;cursor:pointer;background:' +
      color +
      ';color:' +
      on +
      '}' +
      '.send:disabled,.start:disabled{opacity:.6;cursor:default}' +
      '.form{display:grid;gap:10px;padding:4px 2px}' +
      '.form label{display:grid;gap:4px;font-size:13px;font-weight:600}' +
      '.start{padding:12px}' +
      '.note{font-size:12px;color:#5b6472}' +
      '.error{font-size:13px;color:#b91c1c}'
    );
  }

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.3 1.1 4.4 2.9 5.9L4 21l4.2-1.9c1.2.4 2.5.6 3.8.6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>';

  var formError = '';
  var draft = '';

  function render() {
    if (!state.config) return;
    var color = /^#[0-9a-f]{6}$/i.test(state.config.color) ? state.config.color : '#2f5bd7';
    root.innerHTML = '';
    root.appendChild(el('style', { text: styles(color) }));

    var launcher = el('button', {
      class: 'launcher',
      type: 'button',
      'aria-label': state.open ? 'Fechar o chat' : 'Abrir o chat: ' + state.config.title,
      'aria-expanded': state.open ? 'true' : 'false',
      onclick: function () {
        toggle(!state.open);
      },
    });
    launcher.innerHTML = CHAT_ICON; // ícone fixo (não é dado)
    if (state.unread && !state.open) {
      launcher.appendChild(el('span', { class: 'badge', text: String(state.unread) }));
    }
    root.appendChild(launcher);
    if (!state.open) return;

    var body = el('div', { class: 'body', 'aria-live': 'polite' });
    if (state.config.greeting) {
      body.appendChild(el('div', { class: 'msg out', text: state.config.greeting }));
    }
    var foot = null;

    if (PREVIEW) {
      body.appendChild(
        el('p', { class: 'note', text: 'Prévia: o chat funciona no site publicado.' }),
      );
    } else if (!state.session) {
      body.appendChild(renderForm());
    } else {
      state.messages.forEach(function (m) {
        var bubble = el('div', {
          class: 'msg ' + (m.direction === 'inbound' ? 'in' : 'out') + (m.failed ? ' failed' : ''),
          text: m.text,
        });
        if (m.pending) bubble.appendChild(el('div', { class: 'meta', text: 'enviando…' }));
        body.appendChild(bubble);
        if (m.failed) {
          body.appendChild(
            el('button', {
              class: 'retry',
              type: 'button',
              text: m.error || 'Não enviada. Tentar de novo',
              onclick: function () {
                sendMessage(m.text, m);
              },
            }),
          );
        }
      });
      var input = el('textarea', {
        'aria-label': 'Sua mensagem',
        placeholder: 'Escreva sua mensagem…',
        maxlength: '2000',
        oninput: function (event) {
          draft = event.target.value;
        },
        onkeydown: function (event) {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        },
      });
      input.value = draft;
      var submit = function () {
        var text = draft.trim();
        if (!text) return;
        draft = '';
        sendMessage(text);
      };
      foot = el('div', { class: 'foot' }, [
        input,
        el('button', { class: 'send', type: 'button', text: 'Enviar', onclick: submit }),
      ]);
    }

    var panel = el('div', { class: 'panel', role: 'dialog', 'aria-label': state.config.title }, [
      el('div', { class: 'head' }, [
        el('strong', { text: state.config.title }),
        el('button', {
          class: 'close',
          type: 'button',
          'aria-label': 'Fechar o chat',
          text: '×',
          onclick: function () {
            toggle(false);
          },
        }),
      ]),
      body,
      foot,
    ]);
    root.appendChild(panel);
    body.scrollTop = body.scrollHeight;
    var focus = panel.querySelector('textarea, input');
    if (focus && root.activeElement !== focus) focus.focus();
  }

  function renderForm() {
    var name = el('input', { name: 'name', autocomplete: 'name', maxlength: '120', required: '' });
    var phone = el('input', {
      name: 'phone',
      type: 'tel',
      autocomplete: 'tel',
      maxlength: '40',
      placeholder: '(11) 99999-9999',
    });
    var email = el('input', {
      name: 'email',
      type: 'email',
      autocomplete: 'email',
      maxlength: '320',
    });
    var button = el('button', { class: 'start', type: 'submit', text: 'Começar conversa' });
    var form = el(
      'form',
      {
        class: 'form',
        novalidate: '',
        onsubmit: function (event) {
          event.preventDefault();
          var data = {
            name: name.value.trim(),
            phone: phone.value.trim() || null,
            email: email.value.trim() || null,
          };
          if (!data.name) return showError('Diga seu nome.');
          if (!data.phone && !data.email)
            return showError('Informe WhatsApp ou e-mail para podermos responder.');
          button.disabled = true;
          request('POST', '/v1/public/chat/' + encodeURIComponent(KEY) + '/sessions', data, false)
            .then(function (session) {
              formError = '';
              saveSession(session);
              state.messages = [];
              connectSocket();
              render();
            })
            .catch(function (error) {
              button.disabled = false;
              var code = error.code || '';
              showError(
                code.indexOf('PHONE') >= 0
                  ? 'Confira o WhatsApp (com DDD).'
                  : code.indexOf('EMAIL') >= 0
                    ? 'Confira o e-mail.'
                    : code === 'RATE_LIMITED'
                      ? 'Muitas tentativas. Espere um pouco.'
                      : 'Não foi possível começar agora. Tente de novo.',
              );
            });
        },
      },
      [
        el('p', {
          class: 'note',
          text: 'Para começar, diga quem é você. Se sair do site, respondemos pelo WhatsApp ou e-mail.',
        }),
        el('label', {}, [document.createTextNode('Nome'), name]),
        el('label', {}, [document.createTextNode('WhatsApp'), phone]),
        el('label', {}, [document.createTextNode('E-mail'), email]),
        formError ? el('p', { class: 'error', role: 'alert', text: formError }) : null,
        button,
      ],
    );
    function showError(message) {
      formError = message;
      var old = form.querySelector('.error');
      if (old) old.remove();
      form.insertBefore(el('p', { class: 'error', role: 'alert', text: message }), button);
    }
    return form;
  }

  function toggle(open) {
    state.open = open;
    if (open) {
      state.unread = 0;
      refreshMessages();
    }
    render();
  }

  // Esc fecha o painel.
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && state.open) toggle(false);
  });

  // ── início ───────────────────────────────────────────────────────────────
  function start() {
    request('GET', '/v1/public/chat/' + encodeURIComponent(KEY), null, false)
      .then(function (config) {
        if (!config || !config.active) return; // desligado: nada no site
        state.config = config;
        state.session = PREVIEW ? null : loadSession();
        document.body.appendChild(host);
        render();
        if (state.session) {
          connectSocket();
          refreshMessages();
        }
      })
      .catch(function () {
        /* chave inválida ou API fora: o site segue sem chat */
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
