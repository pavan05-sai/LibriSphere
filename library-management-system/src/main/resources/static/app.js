/**
 * LibriSphere - Library Management System Client Application
 */

const API_BASE = window.LIBRISPHERE_API_BASE || '/api';
const $ = (id) => document.getElementById(id);

// State management
let allBooks = [];
let allLoans = [];
let activeLoanFilter = 'all';
let currentSearchTerm = '';
let currentCategory = '';

// Safe HTML Escaping
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Unified API Request helper
async function request(path, options = {}) {
  const url = API_BASE + path;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      let errorMsg = 'An unexpected error occurred.';
      try {
        const body = await res.json();
        errorMsg = body.detail || body.message || body.error || errorMsg;
      } catch {
        try {
          const txt = await res.text();
          if (txt) errorMsg = txt;
        } catch {}
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    throw err;
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
    : type === 'error'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Tab Switching
function switchTab(tabId) {
  ['catalog', 'loans', 'issue'].forEach(t => {
    const tabBtn = $('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    const viewSec = $(t + 'View');
    if (tabBtn) tabBtn.classList.toggle('active', t === tabId);
    if (viewSec) viewSec.classList.toggle('active', t === tabId);
  });

  if (tabId === 'issue') {
    populateIssueSelect();
    const today = new Date().toISOString().split('T')[0];
    $('displayIssueDate').value = today;
  }
}

// Metrics / Stats
async function loadStats() {
  try {
    const s = await request('/stats');
    $('titles').textContent = s.titles ?? 0;
    $('totalCopies').textContent = s.totalCopies ?? 0;
    $('availableCopies').textContent = s.availableCopies ?? 0;
    $('activeLoans').textContent = s.activeLoans ?? 0;
    $('activeLoansBadge').textContent = s.activeLoans ?? 0;

    if (s.totalLoans !== undefined) {
      $('totalLoansInfo').textContent = `${s.activeLoans} active · ${s.totalLoans} all time`;
    }

    if (s.totalCopies > 0) {
      const pct = Math.round((s.availableCopies / s.totalCopies) * 100);
      $('availProgress').style.width = pct + '%';
      $('availProgress').title = `${pct}% available on shelves`;
    } else {
      $('availProgress').style.width = '0%';
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

// Categories
async function loadCategories() {
  try {
    const categories = await request('/categories');
    const filterSelect = $('categoryFilter');
    const dataList = $('categorySuggestions');

    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    filterSelect.value = currentVal;

    if (dataList) {
      dataList.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');
    }
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

// Books & Catalog
async function loadBooks() {
  try {
    const searchParam = currentSearchTerm ? `search=${encodeURIComponent(currentSearchTerm)}` : '';
    const categoryParam = currentCategory ? `category=${encodeURIComponent(currentCategory)}` : '';
    const query = [searchParam, categoryParam].filter(Boolean).join('&');

    allBooks = await request('/books' + (query ? '?' + query : ''));
    renderBooksTable(allBooks);
    populateIssueSelect();
  } catch (e) {
    $('bookRows').innerHTML = `
      <tr><td colspan="6" class="table-loading" style="color:var(--rose)">
        Failed to load catalog: ${escapeHtml(e.message)}
      </td></tr>
    `;
    showToast(e.message, 'error');
  }
}

function renderBooksTable(books) {
  const tbody = $('bookRows');
  if (!books || books.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <h4>No books found</h4>
          <p>${currentSearchTerm || currentCategory ? 'Try adjusting your search query or filter.' : 'Add your first title using the "+ Add New Book" button.'}</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = books.map(b => {
    const isAvail = b.available > 0;
    return `
      <tr>
        <td style="font-family: var(--font-mono); color: var(--text-subtle); font-size: 13px;">#${b.id}</td>
        <td>
          <div class="book-title-cell">
            <span>${escapeHtml(b.title)}</span>
          </div>
        </td>
        <td class="book-author-cell">${escapeHtml(b.author)}</td>
        <td><span class="category-tag">${escapeHtml(b.category || 'General')}</span></td>
        <td>
          <span class="stock-badge ${isAvail ? 'in-stock' : 'out-of-stock'}">
            ${isAvail ? '● ' : '○ '} ${b.available} of ${b.quantity} avail
          </span>
        </td>
        <td>
          <div class="action-group">
            <button class="btn btn-sm btn-primary" onclick="quickIssueBook(${b.id})" ${!isAvail ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} title="Issue copy">
              Issue
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openEditBookModal(${b.id})" title="Edit details">
              Edit
            </button>
            <button class="btn btn-sm btn-danger-outline" onclick="deleteBook(${b.id}, '${escapeHtml(b.title).replace(/'/g, "\\'")}')" title="Delete book">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Issue Select Dropdown Populate
function populateIssueSelect() {
  const select = $('issueBookSelect');
  if (!select) return;
  const currentVal = select.value;
  const availableBooks = allBooks.filter(b => b.available > 0);

  if (availableBooks.length === 0) {
    select.innerHTML = '<option value="">No titles currently in stock</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Choose a title from inventory --</option>' +
    availableBooks.map(b => `
      <option value="${b.id}">${escapeHtml(b.title)} (${b.available} copies available)</option>
    `).join('');

  if (currentVal && availableBooks.some(b => String(b.id) === String(currentVal))) {
    select.value = currentVal;
  }
}

// Quick Issue from catalog row
function quickIssueBook(bookId) {
  switchTab('issue');
  const select = $('issueBookSelect');
  if (select) {
    select.value = String(bookId);
  }
  $('borrowerInput').focus();
}

// Circulation / Loans
async function loadLoans() {
  try {
    allLoans = await request('/loans');
    renderLoansTable(allLoans);
  } catch (e) {
    $('loanRows').innerHTML = `
      <tr><td colspan="7" class="table-loading" style="color:var(--rose)">
        Failed to load loans: ${escapeHtml(e.message)}
      </td></tr>
    `;
  }
}

function filterLoans(filterType) {
  activeLoanFilter = filterType;
  document.querySelectorAll('.filter-pills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterType);
  });
  renderLoansTable(allLoans);
}

function renderLoansTable(loans) {
  const tbody = $('loanRows');
  let filtered = loans || [];
  if (activeLoanFilter === 'active') {
    filtered = filtered.filter(l => !l.returned);
  } else if (activeLoanFilter === 'returned') {
    filtered = filtered.filter(l => l.returned);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h4>No records found</h4>
          <p>${activeLoanFilter === 'active' ? 'No active borrowing loans at this time.' : 'Circulation records will appear here as books are issued.'}</p>
        </div>
      </td></tr>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  tbody.innerHTML = filtered.map(l => {
    const isReturned = l.returned;
    const isOverdue = !isReturned && l.dueDate && l.dueDate < todayStr;

    let statusPill = '';
    if (isReturned) {
      statusPill = `<span class="status-badge returned">✓ Returned (${escapeHtml(l.returnDate || '')})</span>`;
    } else if (isOverdue) {
      statusPill = `<span class="status-badge overdue">⚠ Overdue</span>`;
    } else {
      statusPill = `<span class="status-badge active">● Borrowed</span>`;
    }

    return `
      <tr>
        <td style="font-family: var(--font-mono); color: var(--text-subtle);">#${l.id}</td>
        <td style="font-weight: 600;">${escapeHtml(l.book ? l.book.title : 'Unknown Title')}</td>
        <td>${escapeHtml(l.borrower)}</td>
        <td style="color: var(--text-muted);">${escapeHtml(l.issueDate || '—')}</td>
        <td style="color: ${isOverdue ? 'var(--rose)' : 'var(--text-muted)'}; font-weight: ${isOverdue ? '600' : 'normal'};">
          ${escapeHtml(l.dueDate || '—')}
        </td>
        <td>${statusPill}</td>
        <td>
          <div class="action-group">
            ${isReturned ? '<span style="color:var(--text-subtle);font-size:13px;">Archived</span>' : `
              <button class="btn btn-sm btn-success-outline" onclick="returnBook(${l.id})">
                Mark Returned
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Return Book Action
async function returnBook(loanId) {
  try {
    await request(`/loans/${loanId}/return`, { method: 'PUT' });
    showToast('Book marked as returned successfully! Inventory restored.', 'success');
    await refreshAll();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Delete Book Action
async function deleteBook(id, title) {
  if (!confirm(`Are you sure you want to delete "${title}"?\nActive loans must be returned before deleting.`)) {
    return;
  }
  try {
    await request(`/books/${id}`, { method: 'DELETE' });
    showToast(`Book "${title}" deleted successfully.`, 'success');
    await refreshAll();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Modal Handlers (Add / Edit Book)
function openAddBookModal() {
  $('editBookId').value = '';
  $('modalTitle').textContent = 'Add New Book';
  $('saveBookBtn').textContent = 'Add Book to Catalog';
  $('bookModalForm').reset();
  $('modalBookQuantity').value = 1;
  $('bookModal').classList.remove('hidden');
  $('modalBookTitle').focus();
}

function openEditBookModal(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  $('editBookId').value = book.id;
  $('modalTitle').textContent = 'Edit Book Details';
  $('saveBookBtn').textContent = 'Update Book';
  $('modalBookTitle').value = book.title;
  $('modalBookAuthor').value = book.author;
  $('modalBookCategory').value = book.category || '';
  $('modalBookQuantity').value = book.quantity;
  $('bookModal').classList.remove('hidden');
  $('modalBookTitle').focus();
}

function closeModal() {
  $('bookModal').classList.add('hidden');
  $('bookModalForm').reset();
}

// Handle Add/Edit Book Form Submit
$('bookModalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = $('editBookId').value;
  const payload = {
    title: $('modalBookTitle').value.trim(),
    author: $('modalBookAuthor').value.trim(),
    category: $('modalBookCategory').value.trim() || 'General',
    quantity: parseInt($('modalBookQuantity').value, 10)
  };

  try {
    if (editId) {
      await request(`/books/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast(`Book "${payload.title}" updated successfully!`, 'success');
    } else {
      await request('/books', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`Book "${payload.title}" added to catalog!`, 'success');
    }
    closeModal();
    await refreshAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Handle Issue Form Submit
$('issueForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bookId = $('issueBookSelect').value;
  const borrower = $('borrowerInput').value.trim();

  if (!bookId) {
    showToast('Please select a book to issue.', 'error');
    return;
  }

  try {
    await request('/loans', {
      method: 'POST',
      body: JSON.stringify({ bookId: parseInt(bookId, 10), borrower })
    });
    showToast(`Book successfully issued to ${borrower}!`, 'success');
    $('borrowerInput').value = '';
    $('issueBookSelect').value = '';
    await refreshAll();
    switchTab('loans');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Global Refresh Helper
async function refreshAll() {
  await Promise.all([loadStats(), loadBooks(), loadLoans(), loadCategories()]);
}

// Search & Filter Events
let searchTimeout = null;
$('searchInput').addEventListener('input', (e) => {
  currentSearchTerm = e.target.value.trim();
  $('clearSearchBtn').classList.toggle('hidden', !currentSearchTerm);
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadBooks();
  }, 200);
});

$('clearSearchBtn').addEventListener('click', () => {
  $('searchInput').value = '';
  currentSearchTerm = '';
  $('clearSearchBtn').classList.add('hidden');
  loadBooks();
});

$('categoryFilter').addEventListener('change', (e) => {
  currentCategory = e.target.value;
  loadBooks();
});

$('refreshCatalogBtn').addEventListener('click', async () => {
  showToast('Refreshing catalog...', 'info');
  await refreshAll();
});

// Modal Close Triggers
$('openAddModalBtn').addEventListener('click', openAddBookModal);
$('closeModalBtn').addEventListener('click', closeModal);
$('cancelModalBtn').addEventListener('click', closeModal);
$('bookModal').addEventListener('click', (e) => {
  if (e.target === $('bookModal')) closeModal();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  refreshAll();
  const today = new Date().toISOString().split('T')[0];
  if ($('displayIssueDate')) {
    $('displayIssueDate').value = today;
  }
});
