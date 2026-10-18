/*
 * Agendamento online (ADR 0013). Servido pela API em
 * /v1/public/booking/widget.js e colado no site assim:
 *
 *   <div data-omni-booking></div>
 *   <script src="https://API/v1/public/booking/widget.js" data-key="CHAVE" async></script>
 *
 * Sem dependências e sem build: roda em qualquer site. Desenha dentro do
 * primeiro `[data-omni-booking]` (sem ele, logo antes do script), num Shadow
 * DOM, e todo texto entra como texto (textContent), nunca como HTML. A cor
 * vem das variáveis `--primary` / `--on-primary` do site, se houver.
 *
 * Passos: serviço → profissional (ou qualquer um) → dia → horário → dados →
 * confirmado. Os horários são os livres de verdade; se alguém pegar o mesmo
 * antes, a API responde 409 e o visitante escolhe outro.
 *
 * `data-preview="1"` (prévia do editor de sites): mostra serviços e horários,
 * mas não marca nada.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || window.__omniBookingLoaded) return;
  window.__omniBookingLoaded = true;

  var KEY = script.getAttribute('data-key') || '';
  var PREVIEW = script.getAttribute('data-preview') === '1';
  var API = script.src.replace(/\/v1\/public\/booking\/widget\.js.*$/, '');
  var BASE = '/v1/public/booking/' + encodeURIComponent(KEY);
  var DAYS_PER_PAGE = 7;

  var state = {
    step: 'loading', // loading | error | service | professional | slot | details | done
    error: null,
    info: null, // { today, maxDaysAhead, timezone, services, professionals }
    serviceId: null,
    professionalId: null, // null = qualquer profissional
    date: null,
    dayPage: 0,
    slots: null, // null = carregando
    slotsError: null,
    startsAt: null,
    notice: null,
    sending: false,
    result: null,
  };

  // ── API ──────────────────────────────────────────────────────────────────
  function request(method, path, body) {
    var headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return null;
        })
        .then(function (data) {
          if (!response.ok) {
            var error = new Error((data && data.code) || 'HTTP_' + response.status);
            error.code = (data && data.code) || 'HTTP_' + response.status;
            error.status = response.status;
            throw error;
          }
          return data;
        });
    });
  }

  // ── datas (dia local da empresa como 'AAAA-MM-DD') ───────────────────────
  function parts(date) {
    var p = date.split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(date, days) {
    return new Date(parts(date) + days * 86400000).toISOString().slice(0, 10);
  }
  function dayLabel(date) {
    var at = new Date(parts(date));
    return {
      weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
        .format(at)
        .replace('.', ''),
      day: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      }).format(at),
      long: new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(at),
    };
  }
  function timeLabel(iso) {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: state.info.timezone,
    }).format(new Date(iso));
  }
  function whenLabel(iso) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: state.info.timezone,
    }).format(new Date(iso));
  }
  function money(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      cents / 100,
    );
  }
  function sameZoneAsVisitor() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone === state.info.timezone;
    } catch (e) {
      return true;
    }
  }

  // ── dados ────────────────────────────────────────────────────────────────
  function service() {
    var id = state.serviceId;
    return state.info.services.filter(function (s) {
      return s.id === id;
    })[0];
  }
  function professionalsFor(serviceId) {
    return state.info.professionals.filter(function (p) {
      return p.serviceIds.indexOf(serviceId) !== -1;
    });
  }
  function professionalName(id) {
    var found = state.info.professionals.filter(function (p) {
      return p.id === id;
    })[0];
    return found ? found.name : '';
  }

  function loadInfo() {
    request('GET', BASE)
      .then(function (info) {
        state.info = info;
        state.date = info.today;
        if (info.services.length === 0) {
          state.step = 'error';
          state.error = 'Nenhum serviço disponível para agendamento no momento.';
        } else {
          state.step = 'service';
        }
        render();
      })
      .catch(function () {
        state.step = 'error';
        state.error = 'O agendamento online não está disponível agora.';
        render();
      });
  }

  function loadSlots() {
    var wanted = [state.serviceId, state.professionalId, state.date].join('|');
    state.slots = null;
    state.slotsError = null;
    render();
    var query =
      '?serviceId=' +
      encodeURIComponent(state.serviceId) +
      '&date=' +
      encodeURIComponent(state.date) +
      (state.professionalId ? '&professionalId=' + encodeURIComponent(state.professionalId) : '');
    request('GET', BASE + '/slots' + query)
      .then(function (slots) {
        if ([state.serviceId, state.professionalId, state.date].join('|') !== wanted) return;
        state.slots = slots;
        render();
      })
      .catch(function () {
        if ([state.serviceId, state.professionalId, state.date].join('|') !== wanted) return;
        state.slots = [];
        state.slotsError = 'Não foi possível carregar os horários. Tente de novo.';
        render();
      });
  }

  function errorMessage(error) {
    switch (error.code) {
      case 'APPOINTMENT_SLOT_TAKEN':
        return 'Esse horário acabou de ser ocupado. Escolha outro, por favor.';
      case 'APPOINTMENT_CONTACT_REQUIRED':
        return 'Informe seu WhatsApp ou e-mail para confirmarmos o horário.';
      case 'VALIDATION_ERROR':
        return 'Confira os dados informados.';
      case 'HTTP_429':
        return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
      case 'BOOKING_NOT_FOUND':
        return 'O agendamento online foi desligado. Entre em contato por outro canal.';
      default:
        return 'Não foi possível agendar agora. Tente de novo em instantes.';
    }
  }

  function submit(form) {
    if (state.sending) return;
    var data = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim() || null,
      email: form.elements.email.value.trim() || null,
      notes: form.elements.notes.value.trim() || null,
      website: form.elements.website.value,
    };
    if (!data.name) {
      state.notice = 'Informe seu nome.';
      render();
      return;
    }
    if (!data.phone && !data.email) {
      state.notice = 'Informe seu WhatsApp ou e-mail para confirmarmos o horário.';
      render();
      return;
    }
    if (PREVIEW) {
      state.notice = 'Prévia: no site publicado, o horário é marcado aqui.';
      render();
      return;
    }
    state.sending = true;
    state.notice = null;
    render();
    request('POST', BASE + '/appointments', {
      serviceId: state.serviceId,
      professionalId: state.professionalId,
      startsAt: state.startsAt,
      name: data.name,
      phone: data.phone,
      email: data.email,
      notes: data.notes,
      website: data.website || undefined,
    })
      .then(function (result) {
        state.sending = false;
        state.result = result;
        state.step = 'done';
        render();
      })
      .catch(function (error) {
        state.sending = false;
        if (error.code === 'APPOINTMENT_SLOT_TAKEN') {
          state.step = 'slot';
          state.startsAt = null;
          state.notice = errorMessage(error);
          loadSlots();
          return;
        }
        state.notice = errorMessage(error);
        render();
      });
  }

  // ── tela ─────────────────────────────────────────────────────────────────
  var mount = document.querySelector('[data-omni-booking]');
  if (!mount) {
    mount = document.createElement('div');
    script.parentNode.insertBefore(mount, script);
  }
  // O texto de "carregando" do modelo sai: o widget desenha o próprio.
  mount.textContent = '';
  var root = mount.attachShadow ? mount.attachShadow({ mode: 'open' }) : mount;

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

  var CSS =
    ':host{display:block}' +
    '*{box-sizing:border-box}' +
    '.box{--c:var(--primary,#2563eb);--on:var(--on-primary,#fff);font-family:inherit;color:inherit;max-width:640px;margin:0 auto;text-align:left;font-size:15px;line-height:1.45}' +
    '.card{background:#fff;color:#1f2328;border:1px solid #e6e8ec;border-radius:16px;padding:20px;box-shadow:0 4px 18px rgba(0,0,0,.06)}' +
    '.steps{display:flex;gap:6px;margin:0 0 16px}' +
    '.steps span{flex:1;height:4px;border-radius:2px;background:#e6e8ec}' +
    '.steps span.on{background:var(--c)}' +
    'h3{margin:0 0 4px;font-size:18px}' +
    '.sub{margin:0 0 14px;color:#5b6472;font-size:14px}' +
    '.list{display:grid;gap:8px}' +
    '.opt{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:12px 14px;border:1px solid #e6e8ec;border-radius:12px;background:#fff;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
    '.opt:hover{border-color:var(--c)}' +
    '.opt small{color:#5b6472;white-space:nowrap}' +
    '.days{display:flex;align-items:center;gap:6px;margin:0 0 14px}' +
    '.daylist{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;flex:1}' +
    '.day{padding:8px 2px;border:1px solid #e6e8ec;border-radius:10px;background:#fff;color:inherit;font:inherit;font-size:13px;cursor:pointer;text-align:center;line-height:1.2}' +
    '.day b{display:block;font-size:14px}' +
    '.day.sel{background:var(--c);color:var(--on);border-color:var(--c)}' +
    '.arrow{width:32px;height:32px;flex:none;border:1px solid #e6e8ec;border-radius:50%;background:#fff;color:inherit;cursor:pointer;font-size:16px}' +
    '.arrow:disabled{opacity:.35;cursor:default}' +
    '.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px}' +
    '.slot{padding:9px 0;border:1px solid #e6e8ec;border-radius:10px;background:#fff;color:inherit;font:inherit;cursor:pointer}' +
    '.slot:hover{border-color:var(--c)}' +
    '.empty{color:#5b6472;padding:12px 0}' +
    '.summary{background:#f5f6f8;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:14px}' +
    '.summary b{display:block;font-size:15px}' +
    'label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}' +
    'input,textarea{width:100%;padding:10px 12px;border:1px solid #d0d4da;border-radius:10px;font:inherit;color:#1f2328;background:#fff}' +
    'textarea{min-height:70px;resize:vertical}' +
    'input:focus,textarea:focus{outline:2px solid var(--c);outline-offset:-1px}' +
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px}' +
    '.btn{padding:11px 18px;border:0;border-radius:10px;background:var(--c);color:var(--on);font:inherit;font-weight:600;cursor:pointer}' +
    '.btn:disabled{opacity:.6;cursor:default}' +
    '.link{border:0;background:none;color:#5b6472;font:inherit;cursor:pointer;padding:6px 0;text-decoration:underline}' +
    '.notice{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:#fff4e5;color:#7a4b00;font-size:14px}' +
    '.ok{text-align:center;padding:12px 0}' +
    '.ok .mark{width:56px;height:56px;border-radius:50%;background:var(--c);color:var(--on);display:grid;place-items:center;margin:0 auto 12px;font-size:28px}' +
    '.tz{color:#5b6472;font-size:12px;margin:10px 0 0}';

  var STEP_ORDER = ['service', 'professional', 'slot', 'details', 'done'];

  function progress() {
    var at = STEP_ORDER.indexOf(state.step);
    return el(
      'div',
      { class: 'steps', 'aria-hidden': 'true' },
      STEP_ORDER.slice(0, 4).map(function (_, i) {
        return el('span', { class: i <= at ? 'on' : null });
      }),
    );
  }

  function back(step) {
    return el('button', {
      type: 'button',
      class: 'link',
      text: '← Voltar',
      onclick: function () {
        state.step = step;
        state.notice = null;
        render();
      },
    });
  }

  function viewService() {
    return [
      el('h3', { text: 'Escolha o serviço' }),
      el('p', { class: 'sub', text: 'Agende online, com confirmação na hora.' }),
      el(
        'div',
        { class: 'list' },
        state.info.services.map(function (s) {
          var meta =
            s.durationMinutes + ' min' + (s.priceCents != null ? ' · ' + money(s.priceCents) : '');
          return el(
            'button',
            {
              type: 'button',
              class: 'opt',
              onclick: function () {
                state.serviceId = s.id;
                state.professionalId = null;
                state.notice = null;
                var pros = professionalsFor(s.id);
                if (pros.length <= 1) {
                  // Só uma pessoa faz: nada para escolher.
                  state.professionalId = pros.length === 1 ? pros[0].id : null;
                  goToSlots();
                } else {
                  state.step = 'professional';
                  render();
                }
              },
            },
            [el('span', { text: s.name }), el('small', { text: meta })],
          );
        }),
      ),
    ];
  }

  function viewProfessional() {
    var options = [
      { id: null, name: 'Qualquer profissional', hint: 'o primeiro horário livre' },
    ].concat(
      professionalsFor(state.serviceId).map(function (p) {
        return { id: p.id, name: p.name, hint: '' };
      }),
    );
    return [
      el('h3', { text: 'Com quem?' }),
      el('p', { class: 'sub', text: service().name }),
      el(
        'div',
        { class: 'list' },
        options.map(function (o) {
          return el(
            'button',
            {
              type: 'button',
              class: 'opt',
              onclick: function () {
                state.professionalId = o.id;
                goToSlots();
              },
            },
            [el('span', { text: o.name }), o.hint ? el('small', { text: o.hint }) : null],
          );
        }),
      ),
      el('div', { class: 'row' }, [back('service')]),
    ];
  }

  function goToSlots() {
    state.step = 'slot';
    state.startsAt = null;
    loadSlots();
  }

  function viewSlot() {
    var info = state.info;
    var lastDay = addDays(info.today, info.maxDaysAhead);
    var first = addDays(info.today, state.dayPage * DAYS_PER_PAGE);
    var days = [];
    for (var i = 0; i < DAYS_PER_PAGE; i++) {
      var date = addDays(first, i);
      if (date > lastDay) break;
      days.push(date);
    }
    var pros = professionalsFor(state.serviceId);
    var who = state.professionalId
      ? professionalName(state.professionalId)
      : 'qualquer profissional';

    var slotArea;
    if (state.slots === null) slotArea = el('p', { class: 'empty', text: 'Carregando horários…' });
    else if (state.slotsError) slotArea = el('p', { class: 'empty', text: state.slotsError });
    else if (state.slots.length === 0)
      slotArea = el('p', {
        class: 'empty',
        text: 'Nenhum horário livre neste dia. Experimente outro.',
      });
    else
      slotArea = el(
        'div',
        { class: 'slots' },
        state.slots.map(function (iso) {
          return el('button', {
            type: 'button',
            class: 'slot',
            text: timeLabel(iso),
            onclick: function () {
              state.startsAt = iso;
              state.step = 'details';
              state.notice = null;
              render();
            },
          });
        }),
      );

    return [
      el('h3', { text: 'Escolha o dia e o horário' }),
      el('p', { class: 'sub', text: service().name + ' · ' + who }),
      el('div', { class: 'days' }, [
        el('button', {
          type: 'button',
          class: 'arrow',
          text: '‹',
          'aria-label': 'Dias anteriores',
          disabled: state.dayPage === 0 ? 'disabled' : false,
          onclick: function () {
            state.dayPage -= 1;
            render();
          },
        }),
        el(
          'div',
          { class: 'daylist' },
          days.map(function (date) {
            var label = dayLabel(date);
            return el(
              'button',
              {
                type: 'button',
                class: 'day' + (date === state.date ? ' sel' : ''),
                'aria-label': label.long,
                'aria-pressed': date === state.date ? 'true' : 'false',
                onclick: function () {
                  state.date = date;
                  state.notice = null;
                  loadSlots();
                },
              },
              [el('span', { text: label.weekday }), el('b', { text: label.day.slice(0, 2) })],
            );
          }),
        ),
        el('button', {
          type: 'button',
          class: 'arrow',
          text: '›',
          'aria-label': 'Próximos dias',
          disabled: addDays(first, DAYS_PER_PAGE) > lastDay ? 'disabled' : false,
          onclick: function () {
            state.dayPage += 1;
            render();
          },
        }),
      ]),
      slotArea,
      state.notice ? el('p', { class: 'notice', role: 'alert', text: state.notice }) : null,
      sameZoneAsVisitor()
        ? null
        : el('p', {
            class: 'tz',
            text: 'Horários no fuso do estabelecimento (' + info.timezone + ').',
          }),
      el('div', { class: 'row' }, [back(pros.length > 1 ? 'professional' : 'service')]),
    ];
  }

  function viewDetails() {
    var who = state.professionalId ? ' com ' + professionalName(state.professionalId) : '';
    var form = el(
      'form',
      {
        novalidate: 'novalidate',
        onsubmit: function (event) {
          event.preventDefault();
          submit(form);
        },
      },
      [
        el('div', { class: 'summary' }, [
          el('b', { text: service().name + who }),
          el('span', { text: whenLabel(state.startsAt) }),
        ]),
        el('label', { for: 'ob-name', text: 'Seu nome' }),
        el('input', {
          id: 'ob-name',
          name: 'name',
          autocomplete: 'name',
          maxlength: '200',
          required: 'required',
        }),
        el('label', { for: 'ob-phone', text: 'WhatsApp' }),
        el('input', {
          id: 'ob-phone',
          name: 'phone',
          type: 'tel',
          autocomplete: 'tel',
          maxlength: '40',
          placeholder: '(00) 00000-0000',
        }),
        el('label', { for: 'ob-email', text: 'E-mail' }),
        el('input', {
          id: 'ob-email',
          name: 'email',
          type: 'email',
          autocomplete: 'email',
          maxlength: '320',
        }),
        el('label', { for: 'ob-notes', text: 'Observações (opcional)' }),
        el('textarea', { id: 'ob-notes', name: 'notes', maxlength: '1000' }),
        el('div', { class: 'hp', 'aria-hidden': 'true' }, [
          el('input', { name: 'website', tabindex: '-1', autocomplete: 'off' }),
        ]),
        state.notice ? el('p', { class: 'notice', role: 'alert', text: state.notice }) : null,
        el('div', { class: 'row' }, [
          back('slot'),
          el('button', {
            type: 'submit',
            class: 'btn',
            text: state.sending ? 'Agendando…' : 'Confirmar agendamento',
            disabled: state.sending ? 'disabled' : false,
          }),
        ]),
      ],
    );
    return [
      el('h3', { text: 'Seus dados' }),
      el('p', { class: 'sub', text: 'Para confirmarmos o seu horário.' }),
      form,
    ];
  }

  function viewDone() {
    var result = state.result || {};
    var lines = [];
    if (result.startsAt) {
      lines.push(
        el('p', {
          text:
            (result.serviceName || service().name) +
            (result.professionalName ? ' com ' + result.professionalName : '') +
            ', ' +
            whenLabel(result.startsAt) +
            '.',
        }),
      );
    }
    return [
      el(
        'div',
        { class: 'ok' },
        [el('div', { class: 'mark', text: '✓' }), el('h3', { text: 'Horário agendado!' })].concat(
          lines,
          [
            el('button', {
              type: 'button',
              class: 'link',
              text: 'Agendar outro horário',
              onclick: function () {
                state.step = 'service';
                state.result = null;
                state.startsAt = null;
                state.notice = null;
                render();
              },
            }),
          ],
        ),
      ),
    ];
  }

  function render() {
    var content;
    if (state.step === 'loading')
      content = [el('p', { class: 'empty', text: 'Carregando os horários disponíveis…' })];
    else if (state.step === 'error') content = [el('p', { class: 'empty', text: state.error })];
    else if (state.step === 'service') content = viewService();
    else if (state.step === 'professional') content = viewProfessional();
    else if (state.step === 'slot') content = viewSlot();
    else if (state.step === 'details') content = viewDetails();
    else content = viewDone();

    var showProgress = ['service', 'professional', 'slot', 'details'].indexOf(state.step) !== -1;
    var box = el('div', { class: 'box' }, [
      el('div', { class: 'card' }, [showProgress ? progress() : null].concat(content)),
    ]);
    // Guarda o foco/valores do formulário entre redesenhos.
    var kept = {};
    var old = root.querySelector && root.querySelector('form');
    if (old) {
      ['name', 'phone', 'email', 'notes'].forEach(function (name) {
        kept[name] = old.elements[name].value;
      });
    }
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(el('style', { text: CSS }));
    root.appendChild(box);
    var form = root.querySelector && root.querySelector('form');
    if (form) {
      Object.keys(kept).forEach(function (name) {
        form.elements[name].value = kept[name];
      });
    }
  }

  render();
  loadInfo();
})();
