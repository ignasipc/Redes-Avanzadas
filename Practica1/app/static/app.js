(() => {
  const root = document.documentElement;
  const environment = (root.dataset.environment || 'dev').toLowerCase();
  const cacheEnabled = ['prod', 'production'].includes(environment);

  const mysqlStatus = document.getElementById('mysql-status');
  const mysqlDot = document.getElementById('mysql-dot');
  const redisStatus = document.getElementById('redis-status');
  const redisItem = document.getElementById('redis-status-item');
  const redisDot = document.getElementById('redis-dot');
  const environmentTag = document.getElementById('environment-tag');
  const modal = document.getElementById('fish-modal');
  const form = document.getElementById('fish-form');
  const openButton = document.getElementById('open-modal');
  const closeButton = document.getElementById('close-modal');
  const cancelButton = document.getElementById('cancel-modal');
  const firstField = form?.querySelector('[name="name"]');
  const grid = document.getElementById('fish-grid');
  const emptyState = document.getElementById('empty-state');
  const catalogError = document.getElementById('catalog-error');
  const searchInput = document.getElementById('search-input');
  const waterFilter = document.getElementById('water-filter');
  const temperatureFilter = document.getElementById('temperature-filter');
  const stockFilter = document.getElementById('stock-filter');
  const clearFiltersButton = document.getElementById('clear-filters');
  const emptyClearButton = document.getElementById('empty-clear-filters');
  const resultCount = document.getElementById('result-count');
  const speciesCount = document.getElementById('species-count');
  const stockCount = document.getElementById('stock-count');
  const outOfStockCount = document.getElementById('out-of-stock-count');
  const toast = document.getElementById('toast');
  let lastFocus = null;
  let toastTimer = null;

  if (environmentTag) environmentTag.textContent = cacheEnabled ? 'PRODUCCIÓN' : 'DESARROLLO';

  const normalize = value => (value || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const formatPrice = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value));
  const waterLabel = value => value === 'dulce' ? 'Agua dulce' : 'Agua salada';
  const tempLabel = value => value === 'fria' ? 'Agua fría' : 'Agua cálida';

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      cache: 'no-store'
    });
    let payload = {};
    try { payload = await response.json(); } catch (_error) { /* respuesta vacía */ }
    if (!response.ok) throw new Error(payload.error || `La petición ha fallado (${response.status}).`);
    return payload;
  }

  function setServiceIndicator(labelElement, dotElement, state) {
    if (!labelElement || !dotElement) return;
    const value = typeof state === 'boolean' ? (state ? 'connected' : 'disconnected') : normalize(String(state ?? ''));
    dotElement.className = 'status-dot';

    if (['connected', 'healthy', 'ok', 'available', 'up', 'conectado', 'conectada'].includes(value)) {
      labelElement.textContent = 'Conectado';
      dotElement.classList.add('status-dot--ok');
    } else if (['not_enabled', 'disabled', 'no habilitado', 'no_enabled', 'not enabled'].includes(value)) {
      labelElement.textContent = 'No habilitado';
      dotElement.classList.add('status-dot--off');
    } else if (['disconnected', 'unhealthy', 'down', 'error', 'desconectado', 'desconectada'].includes(value)) {
      labelElement.textContent = 'Desconectado';
      dotElement.classList.add('status-dot--error');
    } else {
      labelElement.textContent = 'Sin verificar';
      dotElement.classList.add('status-dot--off');
    }
  }

  async function refreshServiceStatus() {
    if (!cacheEnabled) {
      if (redisStatus) redisStatus.textContent = 'No habilitado';
      if (redisDot) redisDot.className = 'status-dot status-dot--off';
      if (redisItem) redisItem.title = 'Redis no forma parte del entorno de desarrollo';
    }
    try {
      // /status puede responder HTTP 503 cuando una dependencia está caída;
      // aun así leemos su JSON para mostrar el estado individual de cada servicio.
      const response = await fetch('/status', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const data = await response.json();
      setServiceIndicator(mysqlStatus, mysqlDot, data.database);
      if (cacheEnabled) setServiceIndicator(redisStatus, redisDot, data.cache);
    } catch (_error) {
      setServiceIndicator(mysqlStatus, mysqlDot, 'unknown');
      if (cacheEnabled) setServiceIndicator(redisStatus, redisDot, 'unknown');
    }
  }

  refreshServiceStatus();
  window.setInterval(refreshServiceStatus, 10000);

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => firstField?.focus(), 30);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    form?.reset();
    lastFocus?.focus?.();
  }

  openButton?.addEventListener('click', openModal);
  closeButton?.addEventListener('click', closeModal);
  cancelButton?.addEventListener('click', closeModal);
  modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  function getCards() { return grid ? [...grid.querySelectorAll('.fish-card')] : []; }
  function cardName(card) { return card.querySelector('.fish-title-row h3')?.textContent.trim() || 'este pez'; }

  function ensureCardActions(card) {
    const content = card.querySelector('.fish-card-content');
    if (!content || content.querySelector('.fish-card-actions')) return;
    const name = cardName(card);
    const currentStock = Number(card.dataset.stock || 0);
    const actions = document.createElement('div');
    actions.className = 'fish-card-actions';

    const incrementButton = document.createElement('button');
    incrementButton.className = 'stock-action stock-action--increase';
    incrementButton.type = 'button';
    incrementButton.dataset.action = 'increment-stock';
    incrementButton.title = `Añadir una unidad de ${name} al stock`;
    incrementButton.setAttribute('aria-label', `Añadir una unidad de ${name} al stock`);
    incrementButton.innerHTML = '<span class="stock-action-symbol" aria-hidden="true">+</span><span>Añadir 1</span>';

    const decrementButton = document.createElement('button');
    decrementButton.className = 'stock-action stock-action--decrease';
    decrementButton.type = 'button';
    decrementButton.dataset.action = 'decrement-stock';
    decrementButton.disabled = currentStock <= 0;
    decrementButton.title = `Registrar la salida de una unidad de ${name}`;
    decrementButton.setAttribute('aria-label', `Registrar baja de una unidad de ${name}`);
    decrementButton.innerHTML = '<span class="stock-action-symbol" aria-hidden="true">−</span><span>Retirar 1</span>';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-action';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete-fish';
    deleteButton.title = `Eliminar la ficha de ${name}`;
    deleteButton.setAttribute('aria-label', `Eliminar la ficha completa de ${name} del catálogo`);
    deleteButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 4.5h11M6 4.5V2.7h4v1.8m-6.2 0 .6 8.6h7.2l.6-8.6M6.5 6.5v4.5m3-4.5v4.5"/></svg><span>Eliminar</span>';

    actions.append(incrementButton, decrementButton, deleteButton);
    content.append(actions);
  }

  function refreshSummary() {
    const cards = getCards();
    const totalStock = cards.reduce((sum, card) => sum + Number(card.dataset.stock || 0), 0);
    const emptyCount = cards.filter(card => Number(card.dataset.stock || 0) === 0).length;
    if (speciesCount) speciesCount.textContent = String(cards.length);
    if (stockCount) stockCount.textContent = String(totalStock);
    if (outOfStockCount) outOfStockCount.textContent = String(emptyCount);
  }

  function applyFilters() {
    const query = normalize(searchInput?.value);
    const water = waterFilter?.value || '';
    const temperature = temperatureFilter?.value || '';
    const stockMode = stockFilter?.value || '';
    let visible = 0;
    getCards().forEach(card => {
      const stock = Number(card.dataset.stock || 0);
      const matchesQuery = !query || normalize(`${card.dataset.name} ${card.dataset.species}`).includes(query);
      const matchesWater = !water || card.dataset.water === water;
      const matchesTemp = !temperature || card.dataset.temperature === temperature;
      const matchesStock = !stockMode || (stockMode === 'available' ? stock > 0 : stock === 0);
      const show = matchesQuery && matchesWater && matchesTemp && matchesStock;
      card.hidden = !show;
      if (show) visible++;
    });
    if (resultCount) resultCount.textContent = `${visible} ${visible === 1 ? 'producto' : 'productos'}`;
    if (emptyState) emptyState.hidden = Boolean(catalogError) || visible !== 0;
    refreshSummary();
  }

  function clearFilters() {
    if (searchInput) searchInput.value = '';
    if (waterFilter) waterFilter.value = '';
    if (temperatureFilter) temperatureFilter.value = '';
    if (stockFilter) stockFilter.value = '';
    applyFilters();
    searchInput?.focus();
  }

  searchInput?.addEventListener('input', applyFilters);
  waterFilter?.addEventListener('change', applyFilters);
  temperatureFilter?.addEventListener('change', applyFilters);
  stockFilter?.addEventListener('change', applyFilters);
  clearFiltersButton?.addEventListener('click', clearFilters);
  emptyClearButton?.addEventListener('click', clearFilters);

  function setCardStock(card, newStock) {
    card.dataset.stock = String(newStock);
    const count = card.querySelector('.stock-count');
    const countValue = count?.querySelector('strong');
    const countLabel = count?.querySelector('span');
    const dot = card.querySelector('.stock-dot');
    const available = newStock > 0;
    if (countValue) countValue.textContent = String(newStock);
    if (countLabel) countLabel.textContent = available ? 'en stock' : 'agotado';
    count?.classList.toggle('stock-count--empty', !available);
    if (dot) {
      dot.classList.toggle('stock-dot--available', available);
      dot.classList.toggle('stock-dot--empty', !available);
      dot.title = available ? 'Disponible' : 'Agotado';
    }
    const decrementButton = card.querySelector('[data-action="decrement-stock"]');
    if (decrementButton) decrementButton.disabled = !available;
  }

  async function handleCardAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !grid?.contains(button)) return;
    const card = button.closest('.fish-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const name = cardName(card);
    if (!Number.isInteger(id) || id <= 0) {
      showToast('El registro no tiene un identificador válido en MySQL.');
      return;
    }

    const action = button.dataset.action;
    button.disabled = true;
    try {
      if (action === 'increment-stock' || action === 'decrement-stock') {
        const delta = action === 'increment-stock' ? 1 : -1;
        const result = await requestJson(`/api/fish/${id}/stock`, {
          method: 'PATCH', body: JSON.stringify({ delta })
        });
        setCardStock(card, result.fish.stock);
        applyFilters();
        showToast(`Stock de ${name} actualizado: ${result.fish.stock} unidades.`);
      } else if (action === 'delete-fish') {
        await requestJson(`/api/fish/${id}`, { method: 'DELETE' });
        card.remove();
        applyFilters();
        showToast(`Ficha de ${name} eliminada de MySQL.`);
      }
    } catch (error) {
      showToast(error.message || 'No se ha podido actualizar el inventario.');
      button.disabled = false;
    }
  }

  grid?.addEventListener('click', handleCardAction);

  function cardMarkup(fish) {
    const accent = fish.water_type === 'salada' ? 'coral' : (fish.temperature === 'fria' ? 'mint' : 'aqua');
    const emoji = fish.water_type === 'salada' ? '🐠' : '🐟';
    const stock = Number(fish.stock);
    const available = stock > 0;
    const name = escapeHtml(fish.name);
    const species = escapeHtml(fish.species);
    const water = escapeHtml(fish.water_type);
    const temperature = escapeHtml(fish.temperature);
    const id = Number(fish.id);
    return `
      <article class="fish-card" data-id="${id}" data-name="${escapeHtml(fish.name.toLocaleLowerCase())}" data-species="${escapeHtml(fish.species.toLocaleLowerCase())}" data-water="${water}" data-temperature="${temperature}" data-stock="${stock}">
        <div class="fish-visual fish-visual--${accent}"><span aria-hidden="true">${emoji}</span><span class="water-chip">${waterLabel(water)}</span></div>
        <div class="fish-card-content">
          <div class="fish-title-row"><h3>${name}</h3><span class="stock-dot ${available ? 'stock-dot--available' : 'stock-dot--empty'}" title="${available ? 'Disponible' : 'Agotado'}"></span></div>
          <p class="scientific-name">${species}</p>
          <div class="fish-tags"><span>${tempLabel(temperature)}</span><span>${waterLabel(water)}</span></div>
          <div class="fish-card-footer"><div><span class="price">${formatPrice(fish.price)}</span><span class="price-caption">por unidad</span></div><div class="stock-count ${available ? '' : 'stock-count--empty'}"><strong>${stock}</strong><span>${available ? 'en stock' : 'agotado'}</span></div></div>
        </div>
      </article>`;
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const data = new FormData(form);
    const fish = {
      name: String(data.get('name') || '').trim(),
      species: String(data.get('species') || '').trim(),
      water_type: String(data.get('water_type') || ''),
      temperature: String(data.get('temperature') || ''),
      price: Number(data.get('price')),
      stock: Number(data.get('stock')),
      description: String(data.get('description') || '').trim()
    };
    try {
      const result = await requestJson('/api/fish', { method: 'POST', body: JSON.stringify(fish) });
      grid?.insertAdjacentHTML('beforeend', cardMarkup(result.fish));
      const newCard = grid?.lastElementChild;
      if (newCard) ensureCardActions(newCard);
      closeModal();
      applyFilters();
      showToast(`${result.fish.name} se ha guardado en MySQL.`);
    } catch (error) {
      showToast(error.message || 'No se ha podido guardar el pez.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  getCards().forEach(ensureCardActions);
  if (!cacheEnabled) {
    if (redisStatus) redisStatus.textContent = 'No habilitado';
    if (redisDot) redisDot.className = 'status-dot status-dot--off';
    if (redisItem) redisItem.title = 'Redis no forma parte del entorno de desarrollo';
  }
  applyFilters();
})();
