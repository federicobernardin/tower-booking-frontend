const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzRm6qkOfhgEO3-HVmnjMzVbTjr05tjuM3NcRZKCI7Ldt2Gn7RAYo3Dz1Y1WjJKmaDh5g/exec';

let currentSlots = [];
let selectedSlot = null;

document.addEventListener('DOMContentLoaded', function () {
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

  const filters = {
    struttura: document.getElementById('filterStructure').value,
    fascia: document.getElementById('filterFascia').value
  };

  message.innerHTML = 'Caricamento disponibilità...';
  message.className = 'message';
  list.innerHTML = '';

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

function selectSlot(slotId) {
  selectedSlot = currentSlots.find(function(slot) {
    return String(slot.id_slot) === String(slotId);
  });

  if (!selectedSlot) {
    alert('Slot non trovato.');
    return;
  }

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

function cancelRequestForm() {
  selectedSlot = null;

  document.getElementById('bookingRequestForm').reset();
  document.getElementById('id_slot').value = '';
  document.getElementById('selectedSlotInfo').innerHTML = '';
  document.getElementById('requestMessage').innerHTML = '';
  document.getElementById('requestMessage').className = 'message';
  document.getElementById('requestSection').classList.add('hidden');
}

function submitBookingRequest(event) {
  event.preventDefault();

  const form = document.getElementById('bookingRequestForm');
  const message = document.getElementById('requestMessage');
  const data = formToObject(form);

  data.consenso_privacy = form.querySelector('[name="consenso_privacy"]').checked ? 'SI' : 'NO';

  message.innerHTML = 'Invio richiesta in corso...';
  message.className = 'message';

  apiCall('createBookingRequest', data)
    .then(function(result) {
      message.innerHTML = escapeHtml(result.message || 'Richiesta inviata correttamente.');
      message.className = 'message success';

      form.reset();
      document.getElementById('requestSection').classList.add('hidden');

      loadAvailableSlots();
    })
    .catch(function(error) {
      message.innerHTML = 'Errore durante l’invio della richiesta: ' + escapeHtml(error.message);
      message.className = 'message error';
    });
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
