(() => {
  const root = document.documentElement;
  const environment = (root.dataset.environment || 'dev').toLowerCase();
  const cacheEnabled = environment === 'prod' || environment === 'production';

  const mysqlStatus = document.getElementById('mysql-status');
  const mysqlDot = document.getElementById('mysql-dot');
  const redisStatus = document.getElementById('redis-status');
  const redisItem = document.getElementById('redis-status-item');
  const redisDot = document.getElementById('redis-dot');
  const environmentTag = document.getElementById('environment-tag');

  if (environmentTag) environmentTag.textContent = cacheEnabled ? 'PRODUCCIÓN' : 'DESARROLLO';

  const modal = document.getElementById('fish-modal');
  const form = document.getElementById('fish-form');
  const openButton = document.getElementById('open-modal');
  const closeButton = document.getElementById('close-modal');
  const cancelButton = document.getElementById('cancel-modal');
  const firstField = form?.querySelector('[name="name"]');
  const grid = document.getElementById('fish-grid');
  const emptyState = document.getElementById('empty-state');
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

  const normalize = value => (value || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
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
      const response = await fetch('/status', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const data = await response.json();
      const dbState = data.database ?? data.mysql ?? data.db;
      setServiceIndicator(mysqlStatus, mysqlDot, dbState);

      if (cacheEnabled) {
        const cacheState = data.cache ?? data.redis;
        setServiceIndicator(redisStatus, redisDot, cacheState);
      }
    } catch (_error) {
      // No mostramos estados positivos si Flask aún no expone /status o no responde.
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
  modal?.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  function getCards() {
    return grid ? [...grid.querySelectorAll('.fish-card')] : [];
  }

  function cardName(card) {
    return card.querySelector('.fish-title-row h3')?.textContent.trim() || 'este pez';
  }

  function ensureCardActions(card) {
    const content = card.querySelector('.fish-card-content');
    if (!content || content.querySelector('.fish-card-actions')) return;

    const name = cardName(card);
    const currentStock = Number(card.dataset.stock || 0);
    const actions = document.createElement('div');
    actions.className = 'fish-card-actions';

    const decrementButton = document.createElement('button');
    decrementButton.className = 'stock-action';
    decrementButton.type = 'button';
    decrementButton.dataset.action = 'decrement-stock';
    decrementButton.disabled = currentStock <= 0;
    decrementButton.title = `Registrar la salida de una unidad de ${name}`;
    decrementButton.setAttribute('aria-label', `Registrar baja de una unidad de ${name}`);
    decrementButton.innerHTML = '<span class="stock-action-symbol" aria-hidden="true">−</span><span>1 unidad</span>';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-action';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete-fish';
    deleteButton.title = `Eliminar la ficha de ${name}`;
    deleteButton.setAttribute('aria-label', `Eliminar la ficha completa de ${name} del catálogo`);
    deleteButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 4.5h11M6 4.5V2.7h4v1.8m-6.2 0 .6 8.6h7.2l.6-8.6M6.5 6.5v4.5m3-4.5v4.5"/></svg><span>Eliminar</span>';

    actions.append(decrementButton, deleteButton);
    content.append(actions);
  }

  function refreshSummary() {
    const cards = getCards();
    let totalStock = 0;
    let emptyCount = 0;
    cards.forEach(card => {
      const stock = Number(card.dataset.stock || 0);
      totalStock += stock;
      if (stock === 0) emptyCount++;
    });
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
    if (emptyState) emptyState.hidden = visible !== 0;
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
    if (decrementButton) {
      decrementButton.disabled = !available;
      decrementButton.title = `Registrar la salida de una unidad de ${cardName(card)}`;
    }
  }

  function handleCardAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !grid?.contains(button)) return;
    const card = button.closest('.fish-card');
    if (!card) return;
    const name = cardName(card);

    if (button.dataset.action === 'decrement-stock') {
      const stock = Number(card.dataset.stock || 0);
      if (stock <= 0) {
        showToast(`${name} ya está agotado.`);
        return;
      }
      if (!window.confirm(`¿Registrar la salida de una unidad de «${name}» por venta o pérdida?`)) return;
      setCardStock(card, stock - 1);
      applyFilters();
      showToast(`Stock de ${name} actualizado en la demostración. Aún no se ha guardado en MySQL.`);
    } else if (button.dataset.action === 'delete-fish') {
      if (!window.confirm(`¿Eliminar por completo la ficha de «${name}» del catálogo? Esta acción no equivale a restar una unidad del stock.`)) return;
      card.remove();
      applyFilters();
      showToast(`Ficha de ${name} eliminada de la demostración. Aún no se ha eliminado de MySQL.`);
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
    return `
      <article class="fish-card" data-name="${name.toLocaleLowerCase()}" data-species="${species.toLocaleLowerCase()}" data-water="${fish.water_type}" data-temperature="${fish.temperature}" data-stock="${stock}">
        <div class="fish-visual fish-visual--${accent}"><span aria-hidden="true">${emoji}</span><span class="water-chip">${waterLabel(fish.water_type)}</span></div>
        <div class="fish-card-content">
          <div class="fish-title-row"><h3>${name}</h3><span class="stock-dot ${available ? 'stock-dot--available' : 'stock-dot--empty'}" title="${available ? 'Disponible' : 'Agotado'}"></span></div>
          <p class="scientific-name">${species}</p>
          <div class="fish-tags"><span>${tempLabel(fish.temperature)}</span><span>${waterLabel(fish.water_type)}</span></div>
          <div class="fish-card-footer"><div><span class="price">${formatPrice(fish.price)}</span><span class="price-caption">por unidad</span></div><div class="stock-count ${available ? '' : 'stock-count--empty'}"><strong>${stock}</strong><span>${available ? 'en stock' : 'agotado'}</span></div></div>
        </div>
      </article>`;
  }

  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

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

    if (!fish.name || !fish.species || !['dulce', 'salada'].includes(fish.water_type) || !['fria', 'calida'].includes(fish.temperature) || !Number.isFinite(fish.price) || fish.price < 0 || !Number.isInteger(fish.stock) || fish.stock < 0) {
      showToast('Revisa los datos: hay campos inválidos.');
      return;
    }

    // Demostración de interfaz: después habrá que enviar el alta a Flask y MySQL.
    grid?.insertAdjacentHTML('beforeend', cardMarkup(fish));
    const newCard = grid?.lastElementChild;
    if (newCard) ensureCardActions(newCard);
    closeModal();
    applyFilters();
    showToast('Pez añadido a la demostración. Aún no se ha guardado en MySQL.');
  });

  // Añade las acciones a las seis tarjetas de ejemplo iniciales.
  getCards().forEach(ensureCardActions);
  if (!cacheEnabled) {
    if (redisStatus) redisStatus.textContent = 'No habilitado';
    if (redisDot) redisDot.className = 'status-dot status-dot--off';
    if (redisItem) redisItem.title = 'Redis no forma parte del entorno de desarrollo';
  }
  applyFilters();
})();
