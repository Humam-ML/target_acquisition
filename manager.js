const sessionStr = localStorage.getItem('target_session');
if (!sessionStr) window.location.href = 'index.html';

const session = JSON.parse(sessionStr);

if (new Date().getTime() > session.expires) {
    localStorage.removeItem('target_session');
    window.location.href = 'index.html';
}

const SUPABASE_URL = 'https://dbdbmbtveftcxcnmqobs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZGJtYnR2ZWZ0Y3hjbm1xb2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTg0OTUsImV4cCI6MjA5NTM3NDQ5NX0.k9EugAVx97AlWFpPdy5xNqsqA7WrhamHZVIs-Rqt3J0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let masterData = [];
let sortCol = 'derived_date';
let sortAsc = true;
let searchTerm = ''; // NEW: Search Tracking State

const tableColumns = {
    liquidation_per_product: [
        { key: 'derived_entity', label: 'Target Entity' },
        { key: 'derived_rep', label: 'Rep Name' }, // <-- New Column Added Here
        { key: 'derived_city', label: 'City' },
        { key: 'derived_team', label: 'Team' },
        { key: 'derived_measure', label: 'Measure Unit' },
        { key: 'derived_date', label: 'Month / Date' },
        { key: 'target', label: 'unit_target' },
        { key: 'status', label: 'Status' }
    ],
    liquidation_per_rep: [
        { key: 'derived_entity', label: 'Target Entity' },
        { key: 'derived_city', label: 'City' },
        { key: 'derived_team', label: 'Team' },
        { key: 'derived_level', label: 'Level' }, // <-- Added here
        { key: 'derived_date', label: 'Month / Date' },
        { key: 'target', label: 'Target' },
        { key: 'status', label: 'Status' }
    ],
    visits: [
        { key: 'derived_entity', label: 'Target Entity' },
        { key: 'derived_city', label: 'City' },
        { key: 'derived_team', label: 'Team' },
        { key: 'derived_level', label: 'Level' }, // <-- Added here
        { key: 'derived_date', label: 'Month / Date' },
        { key: 'target', label: 'Target' },
        { key: 'status', label: 'Status' }
    ],
    rtd: [
        { key: 'derived_entity', label: 'Target Entity' },
        { key: 'derived_city', label: 'City' },
        { key: 'derived_date', label: 'Month / Date' },
        { key: 'target', label: 'Target' },
        { key: 'status', label: 'Status' }
    ],
    rx: [
        { key: 'derived_entity', label: 'Target Entity' },
        { key: 'derived_date', label: 'Month / Date' },
        { key: 'target', label: 'Target' },
        { key: 'status', label: 'Status' }
    ],
    coaching: [
        { key: 'derived_entity', label: 'Target Entity' },
        { key: 'derived_date', label: 'Month / Date' },
        { key: 'target', label: 'Target' },
        { key: 'status', label: 'Status' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').textContent = session.username;
    document.getElementById('userLineDisplay').textContent = session.company_line;
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('target_session');
        window.location.href = 'index.html';
    });

    const tableSelector = document.getElementById('tableSelector');
    if (tableSelector) {
        tableSelector.addEventListener('change', (e) => {
            window.fetchTargets(e.target.value);
        });
        window.fetchTargets(tableSelector.value);
    }

    // NEW: Search Input Listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderTable();
        });
    }
});

window.fetchTargets = async function(tableName) {
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    
    // Reset search on module change
    searchTerm = '';
    document.getElementById('searchInput').value = '';
    window.updateBulkUI();

    tableBody.innerHTML = ''; 
    emptyState.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient.rpc('get_manager_data', {
            p_user_id: session.user_id,
            p_table_name: tableName
        });

        if (error) throw error;

        if (!data || data.length === 0) {
            masterData = [];
            emptyState.classList.remove('hidden');
            return;
        }

       masterData = data.map(row => {
            // Aggressive key finder: ignores capitalization and hidden spaces
            const levelKey = Object.keys(row).find(k => k.toLowerCase().trim() === 'level');
            
            return {
                ...row,
                derived_entity: row.product_name || row.rep_name || row.team || 'N/A',
                derived_rep: row.rep_name || row.Rep_Name || row['Rep Name'] || 'N/A', // <-- New Line
                derived_date: row.date || row.month || 'N/A',
                derived_city: row.city || row.City || row.region || row.Region || row.province_code || row.Province_Code || 'N/A',
                derived_team: row.team || row.Team || 'N/A',
                derived_measure: row['Measure Unit'] || row.measure_unit || row.Measure_Unit || 'N/A',
                derived_level: levelKey ? row[levelKey] : 'N/A',
                current_input: row.target !== null && row.target !== undefined ? row.target : '',
                selected: false
            };
        });

        sortCol = 'derived_date'; 
        renderTable();

    } catch (err) {
        console.error("Fetch Error:", err.message);
        emptyState.innerHTML = `<p class="text-sm text-rose-500 font-bold">Failed to load targets.</p>`;
        emptyState.classList.remove('hidden');
    }
};

window.sortData = function(column) {
    if (sortCol === column) {
        sortAsc = !sortAsc;
    } else {
        sortCol = column;
        sortAsc = true;
    }
    renderTable();
};

function renderTable() {
    const tableName = document.getElementById('tableSelector').value;
    const theadRow = document.querySelector('thead tr');
    const tableBody = document.getElementById('tableBody');
    
    const cols = tableColumns[tableName] || tableColumns['rx'];

    let thHtml = `<th class="px-6 py-3 text-left w-12">
        <input type="checkbox" id="masterCheckbox" class="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer" onchange="window.toggleAll(this.checked)">
    </th>`;
    cols.forEach(col => {
        thHtml += `<th onclick="window.sortData('${col.key}')" class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">${col.label} ↕</th>`;
    });
    theadRow.innerHTML = thHtml;

    // NEW: The Filtering Engine (Applies search logic)
    let displayData = masterData.filter(row => {
        if (!searchTerm) return true;
        // Check if ANY value in the row matches the search string
        return Object.values(row).some(val => 
            val !== null && val !== undefined && String(val).toLowerCase().includes(searchTerm)
        );
    });

    // Sort the FILTERED data
    displayData.sort((a, b) => {
        let valA = a[sortCol] !== undefined && a[sortCol] !== null ? a[sortCol] : '';
        let valB = b[sortCol] !== undefined && b[sortCol] !== null ? b[sortCol] : '';
        if (sortCol === 'target') {
            valA = Number(a.current_input || 0);
            valB = Number(b.current_input || 0);
        }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });

    tableBody.innerHTML = '';

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 transition-colors";
        
        const isLocked = (row.status === 'APPROVED' || row.status === 'PENDING');
        const inputClass = isLocked 
            ? "w-full bg-gray-100 border-transparent text-gray-500 cursor-not-allowed rounded px-3 py-2" 
            : "w-full bg-white border border-gray-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded px-3 py-2 outline-none transition-all shadow-sm";
        const statusColor = getStatusColor(row.status);

        let tdHtml = `<td class="px-6 py-4 whitespace-nowrap">
            <input type="checkbox" class="row-checkbox w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer ${isLocked ? 'opacity-30' : ''}" 
                ${isLocked ? 'disabled' : ''} ${row.selected ? 'checked' : ''} 
                onchange="window.toggleSelection('${row.sub_id}', this.checked)">
        </td>`;

        cols.forEach(col => {
            if (col.key === 'target') {
                tdHtml += `<td class="px-6 py-4 whitespace-nowrap">
                    <input type="number" class="target-input ${inputClass}" 
                        value="${row.current_input}" placeholder="0" ${isLocked ? 'disabled' : ''}
                        oninput="window.updateLocalData('${row.sub_id}', this.value)">
                </td>`;
            } else if (col.key === 'status') {
                tdHtml += `<td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${statusColor} shadow-sm border">${row.status || 'EMPTY'}</span>
                </td>`;
            } else {
                tdHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${row[col.key] || 'N/A'}</td>`;
            }
        });

        tr.innerHTML = tdHtml;
        tableBody.appendChild(tr);
    });
    
    // UI check for Master Checkbox based ONLY on visible filtered rows
    const masterCb = document.getElementById('masterCheckbox');
    const allCheckboxes = document.querySelectorAll('.row-checkbox:not(:disabled)');
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked:not(:disabled)');
    if (allCheckboxes.length > 0 && allCheckboxes.length === checkedBoxes.length) {
        masterCb.checked = true;
    } else {
        masterCb.checked = false;
    }
    
    window.updateBulkUI();
}

window.updateLocalData = function(subId, val) {
    const item = masterData.find(d => d.sub_id === subId);
    if (item) item.current_input = val;
};

window.toggleSelection = function(subId, isChecked) {
    const item = masterData.find(d => d.sub_id === subId);
    if (item) item.selected = isChecked;
    window.updateBulkUI();
};

window.toggleAll = function(isChecked) {
    // Only select the rows that are CURRENTLY visible from the search filter
    let displayData = masterData.filter(row => {
        if (!searchTerm) return true;
        return Object.values(row).some(val => 
            val !== null && val !== undefined && String(val).toLowerCase().includes(searchTerm)
        );
    });

    displayData.forEach(item => {
        if (item.status === 'EMPTY' || item.status === 'REJECTED') {
            item.selected = isChecked;
        }
    });
    renderTable();
};

window.updateBulkUI = function() {
    const selectedCount = masterData.filter(d => d.selected).length;
    const bulkBar = document.getElementById('bulkActions');
    if (selectedCount > 0) {
        bulkBar.classList.remove('hidden');
        document.getElementById('selectedCount').textContent = selectedCount;
    } else {
        bulkBar.classList.add('hidden');
    }
};

window.applyBulk = function() {
    const bulkVal = document.getElementById('bulkTargetValue').value;
    if (!bulkVal) return;
    masterData.forEach(item => {
        if (item.selected) item.current_input = bulkVal;
    });
    renderTable(); 
};

function getStatusColor(status) {
    if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'PENDING') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
}

document.getElementById('submitBtn').addEventListener('click', async () => {
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMessage');
    const currentTable = document.getElementById('tableSelector').value;
    
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    const updates = masterData
        .filter(item => (item.status === 'EMPTY' || item.status === 'REJECTED') && item.current_input !== '')
        .map(item => ({
            sub_id: item.sub_id,
            target: Number(item.current_input)
        }));

    if (updates.length === 0) {
        msg.textContent = "No targets to submit.";
        msg.className = "text-sm font-medium text-gray-500 transition-opacity opacity-100";
        btn.disabled = false;
        btn.textContent = 'Submit Targets';
        setTimeout(() => msg.classList.replace('opacity-100', 'opacity-0'), 3000);
        return;
    }

    try {
        const { error } = await supabaseClient.rpc('submit_dynamic_targets', {
            p_user_id: session.user_id,
            p_table_name: currentTable,
            p_updates: updates
        });

        if (error) throw error;

        msg.textContent = "Targets successfully submitted!";
        msg.className = "text-sm font-bold text-emerald-600 transition-opacity opacity-100";
        btn.textContent = 'Submit Targets';
        
        setTimeout(() => {
            msg.classList.replace('opacity-100', 'opacity-0');
            window.fetchTargets(currentTable);
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        console.error("Update Error:", err.message);
        msg.textContent = "Database error saving targets.";
        msg.className = "text-sm font-bold text-rose-600 transition-opacity opacity-100";
        btn.disabled = false;
        btn.textContent = 'Submit Targets';
    }
});