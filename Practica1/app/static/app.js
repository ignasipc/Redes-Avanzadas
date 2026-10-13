(() => {
  const root = document.documentElement;
  const environment = (root.dataset.environment || 'dev').toLowerCase();
  const cacheEnabled = environment === 'prod' || environment === 'production';

  const mysqlStatus = document.getElementById('mysql-status');
  const redisStatus = document.getElementById('redis-status');
  const redisItem = document.getElementById('redis-status-item');
  const redisDot = document.getElementById('redis-dot');
  const environmentTag = document.getElementById('environment-tag');

  if (environmentTag) environmentTag.textContent = cacheEnabled ? 'PRODUCCIÓN' : 'DESARROLLO';
  if (!cacheEnabled) {
    if (redisStatus) redisStatus.textContent = 'No habilitado';
    if (redisDot) redisDot.className = 'status-dot status-dot--off';
    if (redisItem) redisItem.title = 'La caché Redis no forma parte del entorno de desarrollo';
  }

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
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

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

  function getCards() {
    return grid ? [...grid.querySelectorAll('.fish-card')] : [];
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
    let visible = 0;

    getCards().forEach(card => {
      const matchesQuery = !query || normalize(`${card.dataset.name} ${card.dataset.species}`).includes(query);
      const matchesWater = !water || card.dataset.water === water;
      const matchesTemp = !temperature || card.dataset.temperature === temperature;
      const show = matchesQuery && matchesWater && matchesTemp;
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
    applyFilters();
    searchInput?.focus();
  }

  searchInput?.addEventListener('input', applyFilters);
  waterFilter?.addEventListener('change', applyFilters);
  temperatureFilter?.addEventListener('change', applyFilters);
  clearFiltersButton?.addEventListener('click', clearFilters);
  emptyClearButton?.addEventListener('click', clearFilters);

  function cardMarkup(fish) {
    const accent = fish.water_type === 'salada' ? 'coral' : (fish.temperature === 'fria' ? 'mint' : 'aqua');
    const emoji = fish.water_type === 'salada' ? '🐠' : '🐟';
    const stock = Number(fish.stock);
    const available = stock > 0;
    const name = escapeHtml(fish.name);
    const species = escapeHtml(fish.species);
    const description = escapeHtml(fish.description || '');
    return `
      <article class="fish-card" data-name="${name.toLocaleLowerCase()}" data-species="${species.toLocaleLowerCase()}" data-water="${fish.water_type}" data-temperature="${fish.temperature}" data-stock="${stock}" ${description ? `data-description="${description}"` : ''}>
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

    // Demo de interfaz: añade la tarjeta al DOM. Para persistencia real,
    // esta acción debe enviarse a Flask y guardarse en MySQL.
    grid?.insertAdjacentHTML('beforeend', cardMarkup(fish));
    closeModal();
    applyFilters();
    showToast('Pez añadido a la vista de demostración. Aún no se ha guardado en MySQL.');
  });

  applyFilters();
})();
