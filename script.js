// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// 1. 引入 Firebase 模块
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Firebase 配置 (替换为自己的)
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAf_u15MmTaCn0fx6Z9_aTWPKot8xoptTk",
    authDomain: "my-schedule-app-8b64a.firebaseapp.com",
    projectId: "my-schedule-app-8b64a",
    storageBucket: "my-schedule-app-8b64a.firebasestorage.app",
    messagingSenderId: "288900557615",
    appId: "1:288900557615:web:da80a3f0beaeaa70b50fda"
};

// 初始化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventsCollection = collection(db, "events");

document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    var taskListEl = document.getElementById('task-list');

    // ===========================================
    // 1. FullCalendar 配置
    // ===========================================
    var calendar = new FullCalendar.Calendar(calendarEl, {
        // 自定义滚动周视图
        views: {
            rollingWeek: {
                type: 'timeGrid',
                duration: { days: 7 },
                dateIncrement: { days: 1 }, // 每次滑动一天
                buttonText: '7天'
            }
        },
        initialView: 'multiMonthYear', // 默认年历 (平板/手机也生效)
        headerToolbar: false, // 隐藏自带头部，完全靠FAB控制

        locale: 'zh-cn',
        firstDay: 1, // 周一为第一天
        navLinks: false,
        editable: true,
        selectable: true,
        dayMaxEvents: false, // 年历显示小圆点
        nowIndicator: true,  // 红线
        scrollTime: '08:00:00', // 🔴 修复：周历默认滚动到早上8点，而不是0点

        // ===========================================
        // 🟢 交互核心逻辑 (解决冲突)
        // ===========================================

        // A. 点击空白日期 (导航下钻)
        dateClick: function (info) {
            let view = calendar.view.type;
            playAnimation(); // 播放切换动画

            if (view === 'multiMonthYear') {
                // 年 -> 月
                calendar.changeView('dayGridMonth', info.dateStr);
            } else if (view === 'dayGridMonth') {
                // 月 -> 周
                calendar.changeView('rollingWeek', info.dateStr);
            }
            // 注意：周视图(rollingWeek)的点击行为由 select 接管
        },

        // B. 框选时间段 (新建日程)
        select: function (info) {
            // 只有在周视图才允许通过框选新建，防止年/月误触
            if (calendar.view.type === 'rollingWeek') {
                openModal(null, info.startStr, info.endStr);
            }
            calendar.unselect();
        },

        // C. 点击已有日程 (编辑/删除)
        eventClick: function (info) {
            // 任何视图点击日程都弹出编辑
            openModal(info.event);
        },

        // D. 拖拽/缩放日程 (更新时间)
        eventDrop: function (info) { updateDbEvent(info.event); },
        eventResize: function (info) { updateDbEvent(info.event); }
    });

    calendar.render();

    // ===========================================
    // 2. 弹窗与数据逻辑
    // ===========================================
    const modal = document.getElementById('eventModal');

    // 打开弹窗 (新建 或 编辑)
    window.openModal = function (event, startStr, endStr) {
        modal.style.display = 'flex';
        // 如果传了 event，说明是编辑模式
        if (event) {
            document.getElementById('modalTitle').innerText = '✏️ 编辑日程';
            document.getElementById('eventTitleInput').value = event.title;
            document.getElementById('eventIdInput').value = event.id;
            document.getElementById('btnDelete').style.display = 'block';

            // 选中对应的颜色
            let color = event.backgroundColor;
            let radio = document.querySelector(`input[name="eventColor"][value="${color}"]`);
            if (radio) radio.checked = true;

        } else {
            // 新建模式
            document.getElementById('modalTitle').innerText = '📅 新建日程';
            document.getElementById('eventTitleInput').value = '';
            document.getElementById('eventIdInput').value = ''; // 空ID表示新建
            document.getElementById('eventStartInput').value = startStr;
            document.getElementById('eventEndInput').value = endStr;
            document.getElementById('btnDelete').style.display = 'none';
        }
    };

    window.closeModal = function () {
        modal.style.display = 'none';
    };

    // 保存 (新增 或 更新)
    window.saveEvent = function () {
        let title = document.getElementById('eventTitleInput').value;
        let id = document.getElementById('eventIdInput').value;
        let color = document.querySelector('input[name="eventColor"]:checked').value;

        if (!title) return alert("请输入内容");

        if (id) {
            // 更新已有
            updateDoc(doc(db, "events", id), {
                title: title,
                backgroundColor: color,
                borderColor: color
            });
        } else {
            // 新建
            let start = document.getElementById('eventStartInput').value;
            let end = document.getElementById('eventEndInput').value;
            addDoc(eventsCollection, {
                title: title,
                start: start,
                end: end,
                allDay: start.indexOf('T') === -1, // 如果没有时间T，就是全天
                backgroundColor: color,
                borderColor: color
            });
        }
        closeModal();
    };

    // 删除
    window.deleteCurrentEvent = function () {
        let id = document.getElementById('eventIdInput').value;
        if (id && confirm("确定删除吗？")) {
            deleteDoc(doc(db, "events", id));
            closeModal();
        }
    };

    // 辅助：新建日程按钮 (FAB调用)
    window.openCreateModal = function () {
        // 默认新建在今天
        let today = new Date().toISOString().split('T')[0];
        openModal(null, today, today);
        toggleFab(false);
    };

    // ===========================================
    // 3. 视图切换与动画
    // ===========================================
    window.changeView = function (viewName) {
        playAnimation();
        calendar.changeView(viewName);
        toggleFab(false);
    };

    function playAnimation() {
        let container = document.getElementById('calendar-container');
        container.classList.remove('fade-anim');
        void container.offsetWidth; // 触发重绘
        container.classList.add('fade-anim');
    }

    // 更新 Firebase 数据逻辑 (同步)
    const q = query(eventsCollection, orderBy("start", "asc"));
    onSnapshot(q, (snapshot) => {
        document.getElementById('status').innerText = '✅';
        document.getElementById('status').innerText = '✅';
        calendar.removeAllEvents();
        taskListEl.innerHTML = '';

        snapshot.forEach((doc) => {
            let data = doc.data();
            let eventObj = { id: doc.id, ...data };
            let eventObj = { id: doc.id, ...data };
            calendar.addEvent(eventObj);

            // 侧边栏列表渲染
            let div = document.createElement('div');
            div.className = 'task-item';
            div.style.borderLeftColor = data.backgroundColor || '#4a90e2'; // 使用日程颜色
            div.innerHTML = `<b>${data.title}</b><br><small>${data.start}</small>`;
            div.onclick = () => {
                calendar.changeView('rollingWeek', data.start);
                playAnimation();
            };
            taskListEl.appendChild(div);
        });
    });

    function updateDbEvent(e) {
        updateDoc(doc(db, "events", e.id), {
            start: e.startStr, end: e.endStr, allDay: e.allDay
        });
    }
});

// ===========================================
// 4. 修复版 FAB 拖拽逻辑 (兼容 PC 和 Mobile)
// ===========================================
const fab = document.getElementById('fab-container');
const fabMain = document.getElementById('fab-main');

let isDragging = false;
let startX, startY;
let initialLeft, initialTop;

// 通用开始函数
function startDrag(e) {
    isDragging = false;
    // 获取坐标 (兼容 Touch 和 Mouse)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // 移除 bottom/right 定位，改为绝对定位跟随
    fab.style.bottom = 'auto';
    fab.style.right = 'auto';
    fab.style.left = initialLeft + 'px';
    fab.style.top = initialTop + 'px';

    // 绑定移动和结束事件
    if (e.type === 'touchstart') {
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);
    } else {
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    }
}

function onDragMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // 移动超过 5px 才算拖拽
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
    }

    if (isDragging) {
        e.preventDefault(); // 防止页面滚动
        fab.style.left = (initialLeft + dx) + 'px';
        fab.style.top = (initialTop + dy) + 'px';
        toggleFab(false); // 拖拽时收起菜单
    }
}

function onDragEnd(e) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);

    if (!isDragging) {
        // 如果不是拖拽，那就是点击
        toggleFab();
    }
}

// 绑定事件
fabMain.addEventListener('mousedown', startDrag);
fabMain.addEventListener('touchstart', startDrag, { passive: false });

window.toggleFab = function (force) {
    if (typeof force === 'boolean') {
        force ? fab.classList.add('active') : fab.classList.remove('active');
    } else {
        fab.classList.toggle('active');
    }
};