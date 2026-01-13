// ===== Daily Routine Tracker App =====

// State Management
const state = {
    currentDate: new Date(),
    routines: [],
    records: {}, // { 'YYYY-MM-DD': { routineId: boolean } }
    calendarId: null,
    editingRoutineId: null
};

// Storage Keys
const STORAGE_KEYS = {
    ROUTINES: 'routine_tracker_routines',
    RECORDS: 'routine_tracker_records',
    CALENDAR_ID: 'routine_tracker_calendar_id'
};

// ===== Utility Functions =====
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${year}.${month}.${day} (${weekday})`;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function isToday(date) {
    const today = new Date();
    return formatDate(date) === formatDate(today);
}

// ===== Storage Functions =====
function loadFromStorage() {
    try {
        const routines = localStorage.getItem(STORAGE_KEYS.ROUTINES);
        const records = localStorage.getItem(STORAGE_KEYS.RECORDS);
        const calendarId = localStorage.getItem(STORAGE_KEYS.CALENDAR_ID);

        if (routines) state.routines = JSON.parse(routines);
        if (records) state.records = JSON.parse(records);
        if (calendarId) state.calendarId = calendarId;
    } catch (e) {
        console.error('Failed to load from storage:', e);
    }
}

function saveRoutines() {
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(state.routines));
}

function saveRecords() {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(state.records));
}

function saveCalendarId() {
    if (state.calendarId) {
        localStorage.setItem(STORAGE_KEYS.CALENDAR_ID, state.calendarId);
    } else {
        localStorage.removeItem(STORAGE_KEYS.CALENDAR_ID);
    }
}

// ===== Routine Functions =====
function addRoutine(name) {
    const routine = {
        id: generateId(),
        name: name.trim(),
        createdAt: new Date().toISOString()
    };
    state.routines.push(routine);
    saveRoutines();
    renderRoutines();
}

function updateRoutine(id, name) {
    const routine = state.routines.find(r => r.id === id);
    if (routine) {
        routine.name = name.trim();
        saveRoutines();
        renderRoutines();
    }
}

function deleteRoutine(id) {
    state.routines = state.routines.filter(r => r.id !== id);
    // Also clean up records
    Object.keys(state.records).forEach(date => {
        if (state.records[date] && state.records[date][id] !== undefined) {
            delete state.records[date][id];
        }
    });
    saveRoutines();
    saveRecords();
    renderRoutines();
    renderHeatmap();
}

function toggleRoutineCheck(routineId, checked) {
    const dateKey = formatDate(state.currentDate);

    if (!state.records[dateKey]) {
        state.records[dateKey] = {};
    }

    state.records[dateKey][routineId] = checked;
    saveRecords();
    updateProgress();
    renderHeatmap();
}

function getRoutineStatus(routineId, date) {
    const dateKey = formatDate(date);
    return state.records[dateKey]?.[routineId] || false;
}

// ===== Progress Calculation =====
function calculateProgress(date) {
    if (state.routines.length === 0) return 0;

    const dateKey = formatDate(date);
    const dayRecords = state.records[dateKey] || {};

    let completed = 0;
    state.routines.forEach(routine => {
        if (dayRecords[routine.id]) {
            completed++;
        }
    });

    return Math.round((completed / state.routines.length) * 100);
}

function updateProgress() {
    const progress = calculateProgress(state.currentDate);
    const percentEl = document.getElementById('progressPercent');
    const fillEl = document.getElementById('progressFill');

    percentEl.textContent = `${progress}%`;
    fillEl.style.width = `${progress}%`;
}

// ===== Render Functions =====
function renderRoutines() {
    const container = document.getElementById('routineList');

    if (state.routines.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>등록된 루틴이 없습니다.<br>+ 추가 버튼을 눌러 새 루틴을 만들어보세요!</p>
            </div>
        `;
        updateProgress();
        return;
    }

    container.innerHTML = state.routines.map(routine => {
        const isChecked = getRoutineStatus(routine.id, state.currentDate);
        return `
            <div class="routine-item ${isChecked ? 'completed' : ''}" data-id="${routine.id}">
                <label class="checkbox-wrapper">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} data-routine-id="${routine.id}">
                    <span class="checkmark"></span>
                </label>
                <span class="routine-text">${escapeHtml(routine.name)}</span>
                <button class="routine-edit-btn" data-routine-id="${routine.id}" title="수정">✏️</button>
            </div>
        `;
    }).join('');

    // Add event listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const routineId = e.target.dataset.routineId;
            toggleRoutineCheck(routineId, e.target.checked);

            // Update visual state
            const item = e.target.closest('.routine-item');
            item.classList.toggle('completed', e.target.checked);
        });
    });

    container.querySelectorAll('.routine-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const routineId = e.target.dataset.routineId;
            openEditRoutineModal(routineId);
        });
    });

    updateProgress();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    const monthsContainer = document.getElementById('heatmapMonths');

    // Calculate 365 days ago
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // Adjust to start from Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Generate cells
    const cells = [];
    const currentDate = new Date(startDate);
    const months = [];
    let lastMonth = -1;

    while (currentDate <= today || cells.length % 7 !== 0) {
        const dateKey = formatDate(currentDate);
        const progress = calculateProgress(currentDate);
        const level = getHeatmapLevel(progress);
        const isFuture = currentDate > today;

        // Track months for labels
        if (currentDate.getMonth() !== lastMonth && currentDate <= today) {
            months.push({
                name: getMonthName(currentDate.getMonth()),
                position: Math.floor(cells.length / 7)
            });
            lastMonth = currentDate.getMonth();
        }

        cells.push({
            date: dateKey,
            displayDate: formatDisplayDate(currentDate),
            progress,
            level: isFuture ? 0 : level,
            isFuture
        });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Render cells
    grid.innerHTML = cells.map(cell => `
        <div class="heatmap-cell" 
             data-level="${cell.level}" 
             data-date="${cell.date}"
             title="${cell.displayDate}: ${cell.progress}%"
             style="${cell.isFuture ? 'opacity: 0.3;' : ''}">
        </div>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.heatmap-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const dateStr = cell.dataset.date;
            if (dateStr) {
                state.currentDate = new Date(dateStr + 'T00:00:00');
                updateDateDisplay();
                renderRoutines();
            }
        });
    });

    // Render month labels
    renderMonthLabels(months, cells.length / 7);
}

function getHeatmapLevel(progress) {
    if (progress === 0) return 0;
    if (progress <= 25) return 1;
    if (progress <= 50) return 2;
    if (progress <= 75) return 3;
    return 4;
}

function getMonthName(monthIndex) {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월',
        '7월', '8월', '9월', '10월', '11월', '12월'];
    return months[monthIndex];
}

function renderMonthLabels(months, totalWeeks) {
    const container = document.getElementById('heatmapMonths');

    // Simple rendering: show each unique month
    const uniqueMonths = [];
    months.forEach(m => {
        if (uniqueMonths.length === 0 || uniqueMonths[uniqueMonths.length - 1].name !== m.name) {
            uniqueMonths.push(m);
        }
    });

    container.innerHTML = uniqueMonths.map((m, i) => {
        const nextPos = uniqueMonths[i + 1]?.position || totalWeeks;
        const width = (nextPos - m.position) * 15; // 15px per week (12px cell + 3px gap)
        return `<span style="min-width: ${width}px">${m.name}</span>`;
    }).join('');
}

function renderCalendar() {
    const container = document.getElementById('calendarContainer');

    if (!state.calendarId) {
        container.innerHTML = `
            <div class="calendar-placeholder" id="calendarPlaceholder">
                <p>구글 캘린더를 연동하려면 설정 버튼을 클릭하세요</p>
            </div>
        `;
        return;
    }

    // Create Google Calendar embed URL
    const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(state.calendarId)}&ctz=Asia/Seoul&mode=AGENDA&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0`;

    container.innerHTML = `
        <iframe class="calendar-iframe" 
                src="${calendarUrl}" 
                frameborder="0" 
                scrolling="no">
        </iframe>
    `;
}

function updateDateDisplay() {
    const dateEl = document.getElementById('currentDate');
    dateEl.textContent = formatDisplayDate(state.currentDate);
}

// ===== Modal Functions =====
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function openEditRoutineModal(routineId) {
    const routine = state.routines.find(r => r.id === routineId);
    if (!routine) return;

    state.editingRoutineId = routineId;
    document.getElementById('editRoutineInput').value = routine.name;
    openModal('editRoutineModal');
}

// ===== Event Listeners =====
function initEventListeners() {
    // Date navigation
    document.getElementById('prevDay').addEventListener('click', () => {
        state.currentDate.setDate(state.currentDate.getDate() - 1);
        updateDateDisplay();
        renderRoutines();
    });

    document.getElementById('nextDay').addEventListener('click', () => {
        state.currentDate.setDate(state.currentDate.getDate() + 1);
        updateDateDisplay();
        renderRoutines();
    });

    // Add routine modal
    document.getElementById('addRoutineBtn').addEventListener('click', () => {
        document.getElementById('routineInput').value = '';
        openModal('addRoutineModal');
        setTimeout(() => document.getElementById('routineInput').focus(), 100);
    });

    document.getElementById('cancelAddRoutine').addEventListener('click', () => {
        closeModal('addRoutineModal');
    });

    document.getElementById('confirmAddRoutine').addEventListener('click', () => {
        const input = document.getElementById('routineInput');
        const name = input.value.trim();
        if (name) {
            addRoutine(name);
            closeModal('addRoutineModal');
            renderHeatmap();
        }
    });

    document.getElementById('routineInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('confirmAddRoutine').click();
        }
    });

    // Edit routine modal
    document.getElementById('cancelEditRoutine').addEventListener('click', () => {
        closeModal('editRoutineModal');
        state.editingRoutineId = null;
    });

    document.getElementById('saveEditRoutine').addEventListener('click', () => {
        const input = document.getElementById('editRoutineInput');
        const name = input.value.trim();
        if (name && state.editingRoutineId) {
            updateRoutine(state.editingRoutineId, name);
            closeModal('editRoutineModal');
            state.editingRoutineId = null;
        }
    });

    document.getElementById('deleteRoutine').addEventListener('click', () => {
        if (state.editingRoutineId && confirm('정말로 이 루틴을 삭제하시겠습니까?')) {
            deleteRoutine(state.editingRoutineId);
            closeModal('editRoutineModal');
            state.editingRoutineId = null;
        }
    });

    document.getElementById('editRoutineInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('saveEditRoutine').click();
        }
    });

    // Calendar settings modal
    document.getElementById('calendarSettingsBtn').addEventListener('click', () => {
        document.getElementById('calendarIdInput').value = state.calendarId || '';
        openModal('calendarSettingsModal');
        setTimeout(() => document.getElementById('calendarIdInput').focus(), 100);
    });

    document.getElementById('cancelCalendarSettings').addEventListener('click', () => {
        closeModal('calendarSettingsModal');
    });

    document.getElementById('saveCalendarSettings').addEventListener('click', () => {
        const input = document.getElementById('calendarIdInput');
        state.calendarId = input.value.trim() || null;
        saveCalendarId();
        renderCalendar();
        closeModal('calendarSettingsModal');
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                state.editingRoutineId = null;
            }
        });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
            state.editingRoutineId = null;
        }
    });
}

// ===== Initialize App =====
function init() {
    loadFromStorage();
    updateDateDisplay();
    renderRoutines();
    renderHeatmap();
    renderCalendar();
    initEventListeners();

    // Add sample routines if empty (first time user)
    if (state.routines.length === 0) {
        // Optionally add default routines
        // addRoutine('명상 10분');
        // addRoutine('운동 30분');
        // addRoutine('독서 20분');
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
