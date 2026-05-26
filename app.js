const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzRm6qkOfhgEO3-HVmnjMzVbTjr05tjuM3NcRZKCI7Ldt2Gn7RAYo3Dz1Y1WjJKmaDh5g/exec';

const CERTIFIED_UPDATE_TEXT = 'Hai richiesto un aggiornamento certificato. Quando la tua richiesta sarà confermata verrai richiamato al numero di telefono che hai indicato per darti il nome del certificatore che dovrà essere usato nel nulla osta.';

let currentSlots = [];
let selectedSlot = null;

document.addEventListener('DOMContentLoaded', function () {
  initializeAntispamFields();
  ensureConfirmationSection();
  loadAvailableSlots();
});

function apiCall(action, payload) {
  return new Promise(function(resolve, reject) {
    const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);

    const params = new URLSearchParams({
      api: '1',
      action: action,
      payload: JSON.stringify(payload || {}),
      callback: callbackName
    });

    const script = document.createElement('script');

    const timeout = setTimeout(function() {
      cleanup();
      reject(new Error('Timeout nella chiamata API.'));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = function(response) {
      cleanup();

      if (!response || response.ok !== true) {
        reject(new Error(response && response.error ? response.error : 'Errore API sconosciuto.'));
        return;
      }

      resolve(response.data);
    };

    script.onerror = function() {
      cleanup();
      reject(new Error('Errore caricamento script API. Verifica URL Apps Script e deployment.'));
    };

    script.src = WEB_APP_URL + '?' + params.toString();
    document.body.appendChild(script);
  });
}

function loadAvailableSlots() {
  const message = document.getElementById('slotsMessage');
  const list = document.getElementById('slotsList');

  const structure = document.getElementById('filterStructure').value;
  const fascia = document.getElementById('filterFascia').value;

  message.innerHTML = 'Caricamento disponibilità...';
  message.className = 'message';
  list.innerHTML = '';
  currentSlots = [];
  selectedSlot = null;

  if (structure === 'Torre + Laboratorio') {
    loadAvailableCombinedSlots();
    return;
  }

  const filters = {
    struttura: structure,
    fascia: fascia
  };

  apiCall('getAvailableSlots', filters)
    .then(function(result) {
      currentSlots = result.slots || [];
      renderSlots(currentSlots);
    })
    .catch(function(error) {
      message.innerHTML = 'Errore nel caricamento degli slot: ' + escapeHtml(error.message);
      message.className = 'message error';
    });
}

function loadAvailableCombinedSlots() {
  const message = document.getElementById('slotsMessage');
  const list = document.getElementById('slotsList');

  const fascia = document.getElementById('filterFascia').value;

  if (fascia) {
    message.innerHTML = 'Per la combinazione Torre + Laboratorio il filtro fascia viene ignorato: vengono cercate combinazioni mattina + pomeriggio.';
    message.className = 'message';
  }

  apiCall('getAvailableCombinedSlots', {})
    .then(function(result) {
      currentSlots = result.combinations || [];
      renderCombinedSlots(currentSlots);
    })
    .catch(function(error) {
      list.innerHTML = '';
      message.innerHTML = 'Errore nel caricamento delle combinazioni: ' + escapeHtml(error.message);
      message.className = 'message error';
    });
}

function renderSlots(slots) {
  const message = document.getElementById('slotsMessage');
  const list = document.getElementById('slotsList');

  if (!slots || slots.length === 0) {
    message.innerHTML = 'Non ci sono slot disponibili per i filtri selezionati.';
    message.className = 'message';
    list.innerHTML = '';
    return;
  }

  message.innerHTML = 'Slot disponibili: ' + slots.length;
  message.className = 'message success';

  let html = '';

  slots.forEach(function(slot) {
    html += '<article class="slot-card">';
    html += '<span class="slot-badge">Disponibile</span>';
    html += '<h3>' + escapeHtml(slot.struttura) + '</h3>';

    html += '<div class="slot-meta">';
    html += '<div><strong>Data</strong><span>' + escapeHtml(slot.data) + '</span></div>';
    html += '<div><strong>Fascia</strong><span>' + escapeHtml(slot.fascia) + '</span></div>';
    html += '<div><strong>Orario</strong><span>' + escapeHtml(slot.ora_inizio + ' - ' + slot.ora_fine) + '</span></div>';
    html += '<div><strong>Capienza massima</strong><span>' + escapeHtml(slot.capienza_max) + '</span></div>';
    html += '</div>';

    html += '<button type="button" onclick="selectSlot(\'' + escapeJs(slot.id_slot) + '\')">Richiedi questo slot</button>';
    html += '</article>';
  });

  list.innerHTML = html;
}

function renderCombinedSlots(combinations) {
  const message = document.getElementById('slotsMessage');
  const list = document.getElementById('slotsList');

  if (!combinations || combinations.length === 0) {
    message.innerHTML = 'Non ci sono combinazioni disponibili Torre + Laboratorio.';
    message.className = 'message';
    list.innerHTML = '';
    return;
  }

  message.innerHTML = 'Combinazioni disponibili Torre + Laboratorio: ' + combinations.length;
  message.className = 'message success';

  let html = '';

  combinations.forEach(function(combo) {
    html += '<article class="slot-card">';
    html += '<span class="slot-badge">Giornata combinata</span>';
    html += '<h3>' + escapeHtml(combo.struttura) + '</h3>';

    html += '<div class="slot-meta">';
    html += '<div><strong>Data</strong><span>' + escapeHtml(combo.data) + '</span></div>';
    html += '<div><strong>Mattina</strong><span>' + escapeHtml(combo.mattina.struttura + ' ' + combo.mattina.ora_inizio + ' - ' + combo.mattina.ora_fine) + '</span></div>';
    html += '<div><strong>Pomeriggio</strong><span>' + escapeHtml(combo.pomeriggio.struttura + ' ' + combo.pomeriggio.ora_inizio + ' - ' + combo.pomeriggio.ora_fine) + '</span></div>';
    html += '<div><strong>Capienza indicativa</strong><span>' + escapeHtml(combo.capienza_max) + '</span></div>';
    html += '</div>';

    html += '<button type="button" onclick="selectCombinedSlot(\'' + escapeJs(combo.id_combo) + '\')">Richiedi questa combinazione</button>';
    html += '</article>';
  });

  list.innerHTML = html;
}

function selectSlot(slotId) {
  selectedSlot = currentSlots.find(function(slot) {
    return String(slot.id_slot) === String(slotId);
  });

  if (!selectedSlot) {
    alert('Slot non trovato.');
    return;
  }

  hideConfirmation();

  document.getElementById('id_slot').value = selectedSlot.id_slot;

  document.getElementById('selectedSlotInfo').innerHTML =
    '<strong>Slot selezionato</strong><br>' +
    'Struttura: ' + escapeHtml(selectedSlot.struttura) + '<br>' +
    'Data: ' + escapeHtml(selectedSlot.data) + '<br>' +
    'Fascia: ' + escapeHtml(selectedSlot.fascia) + '<br>' +
    'Orario: ' + escapeHtml(selectedSlot.ora_inizio + ' - ' + selectedSlot.ora_fine);

  document.getElementById('requestSection').classList.remove('hidden');
  document.getElementById('requestMessage').innerHTML = '';
  document.getElementById('requestMessage').className = 'message';

  document.getElementById('requestSection').scrollIntoView({
    behavior: 'smooth'
  });
}

function selectCombinedSlot(comboId) {
  selectedSlot = currentSlots.find(function(combo) {
    return String(combo.id_combo) === String(comboId);
  });

  if (!selectedSlot) {
    alert('Combinazione non trovata.');
    return;
  }

  hideConfirmation();

  document.getElementById('id_slot').value = selectedSlot.id_combo;

  document.getElementById('selectedSlotInfo').innerHTML =
    '<strong>Combinazione selezionata</strong><br>' +
    'Data: ' + escapeHtml(selectedSlot.data) + '<br>' +
    'Mattina: ' + escapeHtml(selectedSlot.mattina.struttura + ' ' + selectedSlot.mattina.ora_inizio + ' - ' + selectedSlot.mattina.ora_fine) + '<br>' +
    'Pomeriggio: ' + escapeHtml(selectedSlot.pomeriggio.struttura + ' ' + selectedSlot.pomeriggio.ora_inizio + ' - ' + selectedSlot.pomeriggio.ora_fine) + '<br><br>' +
    '<strong>Nota:</strong> la richiesta verrà registrata come due richieste collegate, una per la mattina e una per il pomeriggio.';

  document.getElementById('requestSection').classList.remove('hidden');
  document.getElementById('requestMessage').innerHTML = '';
  document.getElementById('requestMessage').className = 'message';

  document.getElementById('requestSection').scrollIntoView({
    behavior: 'smooth'
  });
}

function cancelRequestForm() {
  selectedSlot = null;

  document.getElementById('bookingRequestForm').reset();
  initializeAntispamFields();
  resetTurnstileWidget();

  document.getElementById('id_slot').value = '';
  document.getElementById('selectedSlotInfo').innerHTML = '';
  document.getElementById('requestMessage').innerHTML = '';
  document.getElementById('requestMessage').className = 'message';
  document.getElementById('requestSection').classList.add('hidden');
}

function submitBookingRequest(event) {
  event.preventDefault();

  if (!selectedSlot) {
    alert('Seleziona uno slot prima di inviare la richiesta.');
    return;
  }

  const form = document.getElementById('bookingRequestForm');
  const submitButton = form.querySelector('button[type="submit"]');
  const message = document.getElementById('requestMessage');
  const data = formToObject(form);

  data.consenso_privacy = form.querySelector('[name="consenso_privacy"]').checked ? 'SI' : 'NO';
  data.aggiornamento_certificato = form.querySelector('[name="aggiornamento_certificato"]') && form.querySelector('[name="aggiornamento_certificato"]').checked ? 'SI' : 'NO';

  data.website = form.querySelector('[name="website"]') ? form.querySelector('[name="website"]').value : '';
  data.form_started_at = document.getElementById('form_started_at') ? document.getElementById('form_started_at').value : '';
  data.turnstile_token = getTurnstileToken();

  if (!data.turnstile_token) {
    message.innerHTML = 'Completa la verifica anti-spam prima di inviare la richiesta.';
    message.className = 'message error';
    return;
  }

  const submittedSlot = selectedSlot ? JSON.parse(JSON.stringify(selectedSlot)) : null;
  const submittedData = Object.assign({}, data);

  message.innerHTML = 'Invio richiesta in corso...';
  message.className = 'message';

  setSubmitState(submitButton, true);

  let action = 'createBookingRequest';
  let payload = data;

  if (selectedSlot.tipo_slot === 'combinato') {
    action = 'createCombinedBookingRequest';
    payload = Object.assign({}, data, {
      id_slot_mattina: selectedSlot.mattina.id_slot,
      id_slot_pomeriggio: selectedSlot.pomeriggio.id_slot
    });
  }

  apiCall(action, payload)
    .then(function(result) {
      form.reset();
      initializeAntispamFields();
      resetTurnstileWidget();

      document.getElementById('requestSection').classList.add('hidden');
      document.getElementById('requestMessage').innerHTML = '';
      document.getElementById('selectedSlotInfo').innerHTML = '';

      selectedSlot = null;

      showConfirmation(submittedSlot, submittedData, result);
      loadAvailableSlots();
    })
    .catch(function(error) {
      message.innerHTML = 'Errore durante l’invio della richiesta: ' + escapeHtml(error.message);
      message.className = 'message error';
      resetTurnstileWidget();
    })
    .finally(function() {
      setSubmitState(submitButton, false);
    });
}

function setSubmitState(button, isSubmitting) {
  if (!button) {
    return;
  }

  if (isSubmitting) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = 'Invio in corso...';
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || 'Invia richiesta';
  }
}

function ensureConfirmationSection() {
  if (document.getElementById('confirmationSection')) {
    return;
  }

  const section = document.createElement('section');
  section.id = 'confirmationSection';
  section.className = 'card hidden';

  section.innerHTML =
    '<div class="section-title">' +
      '<div>' +
        '<h2>Richiesta ricevuta</h2>' +
        '<p>La richiesta è stata registrata correttamente.</p>' +
      '</div>' +
    '</div>' +
    '<div id="confirmationContent"></div>' +
    '<div class="actions">' +
      '<button type="button" onclick="hideConfirmation()">Chiudi riepilogo</button>' +
    '</div>';

  const requestSection = document.getElementById('requestSection');

  if (requestSection && requestSection.parentNode) {
    requestSection.parentNode.insertBefore(section, requestSection.nextSibling);
  } else {
    document.querySelector('main').appendChild(section);
  }
}

function showConfirmation(slot, data, result) {
  ensureConfirmationSection();

  const section = document.getElementById('confirmationSection');
  const content = document.getElementById('confirmationContent');

  const isCombined = result && result.combined === true;

  let html = '';

  html += '<div class="message success">';
  html += '<strong>Richiesta ricevuta correttamente.</strong><br>';

  if (isCombined) {
    html += 'La richiesta combinata è stata registrata come due richieste collegate. ';
  }

  html += 'La prenotazione non è ancora confermata. ';
  html += 'Il coordinamento verificherà la disponibilità della struttura e dei volontari ';
  html += 'e ti invierà una comunicazione all’indirizzo email indicato.';
  html += '</div>';

  if (data && data.aggiornamento_certificato === 'SI') {
    html += '<div class="message">';
    html += escapeHtml(CERTIFIED_UPDATE_TEXT);
    html += '</div>';
  }

  if (result && result.requesterNotification) {
    if (result.requesterNotification.success === true) {
      html += '<div class="message success">';
      html += 'Ti abbiamo inviato una copia della richiesta all’indirizzo email indicato.';
      html += '</div>';
    } else {
      html += '<div class="message">';
      html += 'La richiesta è stata salvata correttamente, ma non è stato possibile inviare la copia automatica all’indirizzo email indicato.';
      html += '</div>';
    }
  }

  html += '<div class="selected-slot">';

  if (isCombined) {
    html += buildCombinedConfirmationHtml(slot, data, result);
  } else {
    html += buildSingleConfirmationHtml(slot, data, result);
  }

  html += '</div>';

  if (result && result.notification) {
    if (result.notification.success === true) {
      html += '<div class="message success">';
      html += 'Il coordinamento è stato avvisato automaticamente.';
      html += '</div>';
    } else {
      html += '<div class="message error">';
      html += 'La richiesta è stata salvata, ma la notifica automatica al coordinamento potrebbe non essere partita. ';
      html += 'Il coordinatore potrà comunque vedere la richiesta nell’area riservata.';
      html += '</div>';
    }
  }

  content.innerHTML = html;
  section.classList.remove('hidden');

  section.scrollIntoView({
    behavior: 'smooth'
  });
}

function buildSingleConfirmationHtml(slot, data, result) {
  const requestId = getRequestId(result);

  let html = '';

  html += '<strong>Riepilogo richiesta</strong><br>';

  if (requestId) {
    html += 'ID richiesta: ' + escapeHtml(requestId) + '<br>';
  }

  if (slot) {
    html += 'Struttura: ' + escapeHtml(slot.struttura) + '<br>';
    html += 'Data: ' + escapeHtml(slot.data) + '<br>';
    html += 'Fascia: ' + escapeHtml(slot.fascia) + '<br>';
    html += 'Orario: ' + escapeHtml(slot.ora_inizio + ' - ' + slot.ora_fine) + '<br>';
  }

  html += buildRequesterSummaryHtml(data);

  return html;
}

function buildCombinedConfirmationHtml(slot, data, result) {
  let html = '';

  html += '<strong>Riepilogo richiesta combinata</strong><br>';

  if (result.id_gruppo_richiesta) {
    html += 'ID gruppo richiesta: ' + escapeHtml(result.id_gruppo_richiesta) + '<br>';
  }

  if (result.requests && result.requests.mattina) {
    const morningRequestId = getRequestId({ request: result.requests.mattina });

    if (morningRequestId) {
      html += 'ID richiesta mattina: ' + escapeHtml(morningRequestId) + '<br>';
    }
  }

  if (result.requests && result.requests.pomeriggio) {
    const afternoonRequestId = getRequestId({ request: result.requests.pomeriggio });

    if (afternoonRequestId) {
      html += 'ID richiesta pomeriggio: ' + escapeHtml(afternoonRequestId) + '<br>';
    }
  }

  if (slot) {
    html += '<br>';
    html += 'Data: ' + escapeHtml(slot.data) + '<br>';
    html += 'Mattina: ' + escapeHtml(slot.mattina.struttura + ' ' + slot.mattina.ora_inizio + ' - ' + slot.mattina.ora_fine) + '<br>';
    html += 'Pomeriggio: ' + escapeHtml(slot.pomeriggio.struttura + ' ' + slot.pomeriggio.ora_inizio + ' - ' + slot.pomeriggio.ora_fine) + '<br>';
  }

  html += buildRequesterSummaryHtml(data);

  return html;
}

function buildRequesterSummaryHtml(data) {
  let html = '';

  html += '<br>';
  html += 'Referente: ' + escapeHtml((data.nome_referente || '') + ' ' + (data.cognome_referente || '')) + '<br>';
  html += 'Email: ' + escapeHtml(data.email || '') + '<br>';
  html += 'Telefono: ' + escapeHtml(data.telefono || '') + '<br>';
  html += 'Gruppo: ' + escapeHtml(data.sezione_gruppo || '') + '<br>';
  html += 'Tipologia gruppo: ' + escapeHtml(data.tipologia_gruppo || '') + '<br>';
  html += 'Partecipanti: ' + escapeHtml(data.numero_partecipanti || '') + '<br>';
  html += 'Accompagnatori: ' + escapeHtml(data.numero_accompagnatori || 0) + '<br>';
  html += 'Aggiornamento certificato: ' + escapeHtml(data.aggiornamento_certificato === 'SI' ? 'SI' : 'NO') + '<br>';

  if (data.finalita) {
    html += '<br>';
    html += '<strong>Finalità</strong><br>';
    html += escapeHtml(data.finalita);
  }

  return html;
}

function hideConfirmation() {
  const section = document.getElementById('confirmationSection');

  if (section) {
    section.classList.add('hidden');
  }
}

function showTestConfirmation() {
  const testSlot = {
    id_slot: 'SLOT_TEST',
    struttura: 'Torre',
    data: '13/06/2026',
    fascia: 'Pomeriggio',
    ora_inizio: '14:00',
    ora_fine: '18:00',
    capienza_max: 20
  };

  const testData = {
    id_slot: 'SLOT_TEST',
    nome_referente: 'Mario',
    cognome_referente: 'Rossi',
    email: 'mario.rossi@example.com',
    telefono: '3331234567',
    sezione_gruppo: 'Sezione CAI Test',
    tipologia_gruppo: 'Scuola CAI',
    numero_partecipanti: 12,
    numero_accompagnatori: 2,
    finalita: 'Test riepilogo richiesta senza invio reale del form.',
    note_richiedente: 'Nota di test.',
    consenso_privacy: 'SI',
    aggiornamento_certificato: 'SI'
  };

  const testResult = {
    success: true,
    request: {
      id_richiesta: 'REQ_TEST_001'
    },
    notification: {
      success: true,
      sent: 0,
      message: 'Notifica al coordinamento gestita dalla funzione createBookingRequest.'
    },
    requesterNotification: {
      success: true,
      sent: 1,
      message: 'Email di presa in carico inviata al richiedente.'
    },
    message: 'Richiesta di test inviata correttamente.'
  };

  showConfirmation(testSlot, testData, testResult);
}

function showTestCombinedConfirmation() {
  const testSlot = {
    tipo_slot: 'combinato',
    id_combo: 'COMBO_TEST',
    struttura: 'Torre + Laboratorio',
    data: '13/06/2026',
    fascia: 'Giornata combinata',
    mattina: {
      id_slot: 'SLOT_M_TEST',
      struttura: 'Torre',
      data: '13/06/2026',
      fascia: 'Mattina',
      ora_inizio: '08:30',
      ora_fine: '12:30'
    },
    pomeriggio: {
      id_slot: 'SLOT_P_TEST',
      struttura: 'Laboratorio',
      data: '13/06/2026',
      fascia: 'Pomeriggio',
      ora_inizio: '14:00',
      ora_fine: '18:00'
    }
  };

  const testData = {
    nome_referente: 'Mario',
    cognome_referente: 'Rossi',
    email: 'mario.rossi@example.com',
    telefono: '3331234567',
    sezione_gruppo: 'Sezione CAI Test',
    tipologia_gruppo: 'Scuola CAI',
    numero_partecipanti: 12,
    numero_accompagnatori: 2,
    finalita: 'Test riepilogo richiesta combinata senza invio reale del form.',
    note_richiedente: 'Nota di test.',
    consenso_privacy: 'SI',
    aggiornamento_certificato: 'SI'
  };

  const testResult = {
    success: true,
    combined: true,
    id_gruppo_richiesta: 'GRP_TEST_001',
    requests: {
      mattina: {
        id_richiesta: 'REQ_TEST_MATTINA'
      },
      pomeriggio: {
        id_richiesta: 'REQ_TEST_POMERIGGIO'
      }
    },
    notification: {
      success: true,
      sent: 0,
      message: 'Notifiche al coordinamento gestite dalle due chiamate createBookingRequest.'
    },
    requesterNotification: {
      success: true,
      sent: 1,
      message: 'Email di presa in carico combinata inviata al richiedente.'
    }
  };

  showConfirmation(testSlot, testData, testResult);
}

function initializeAntispamFields() {
  window.formStartedAt = new Date().getTime();

  const field = document.getElementById('form_started_at');

  if (field) {
    field.value = String(window.formStartedAt);
  }
}

function getTurnstileToken() {
  const tokenInput = document.querySelector('[name="cf-turnstile-response"]');

  if (!tokenInput) {
    return '';
  }

  return String(tokenInput.value || '').trim();
}

function resetTurnstileWidget() {
  if (window.turnstile && typeof window.turnstile.reset === 'function') {
    try {
      window.turnstile.reset();
    } catch (error) {
      console.warn('Impossibile resettare Turnstile:', error);
    }
  }
}

function goToVolunteerArea() {
  window.open(WEB_APP_URL + '?view=volunteer', '_blank');
}

function goToCoordinatorArea() {
  window.open(WEB_APP_URL + '?view=coordinator', '_blank');
}

function goToDashboard() {
  window.open(WEB_APP_URL + '?view=dashboard', '_blank');
}

function getRequestId(result) {
  if (!result) {
    return '';
  }

  if (result.request) {
    return result.request.id_richiesta ||
      result.request.requestId ||
      result.request.id ||
      '';
  }

  return result.id_richiesta ||
    result.requestId ||
    result.id ||
    '';
}

function formToObject(form) {
  const formData = new FormData(form);
  const data = {};

  formData.forEach(function(value, key) {
    data[key] = value;
  });

  return data;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}