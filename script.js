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

    // =========================================
    // 1. FullCalendar 配置
    // =========================================
    var calendar = new FullCalendar.Calendar(calendarEl, {
        // 自定义视图：滚动周历
        views: {
            rollingWeek: {
                type: 'timeGrid',
                duration: { days: 7 }, // 一次看7天
                buttonText: '7天视图',
                // 关键点：点击前进/后退时，只移动1天，产生“滑动”感
                dateIncrement: { days: 1 }
            }
        },
        initialView: 'dayGridMonth', // 默认月历

        // 界面配置
        headerToolbar: {
            left: 'prev,next today', // 保留导航箭头
            center: 'title',
            right: '' // 隐藏原生视图切换按钮，使用悬浮球
        },
        locale: 'zh-cn',
        navLinks: false,
        editable: true,
        selectable: true,
        dayMaxEvents: true,

        // 🟢 需求：当前时间红线
        nowIndicator: true,

        // 🟢 需求：月历点击某天 -> 跳转到该天的 7 天视角
        dateClick: function (info) {
            let currentView = calendar.view.type;

            if (currentView === 'dayGridMonth' || currentView === 'multiMonthYear') {
                // 跳转到 rollingWeek 并定位到点击的那一天
                calendar.changeView('rollingWeek', info.dateStr);
            }
        },

        // 选择时间段新建
        select: function (info) {
            // 在周视图里，可以直接框选时间段
            createEvent(info.startStr, info.endStr, info.allDay);
            calendar.unselect();
        },

        // 事件操作
        eventClick: function (info) {
            if (confirm("删除日程: " + info.event.title + "?")) {
                deleteDoc(doc(db, "events", info.event.id));
            }
        },
        eventDrop: function (info) { updateDbEvent(info.event); },
        eventResize: function (info) { updateDbEvent(info.event); }
    });

    calendar.render();

    // 暴露给全局，供悬浮按钮调用
    window.changeView = function (viewName) {
        calendar.changeView(viewName);
        toggleFab(false); // 切换后自动收起菜单
    };

    window.manualAddEvent = function () {
        let title = prompt("请输入日程:");
        if (title) {
            let today = new Date().toISOString().split('T')[0];
            addDoc(eventsCollection, {
                title: title,
                start: today,
                end: today,
                allDay: true
            });
        }
        toggleFab(false);
    };


    // =========================================
    // 2. Firebase 同步逻辑 (保持不变)
    // =========================================
    const q = query(eventsCollection, orderBy("start", "asc"));
    onSnapshot(q, (snapshot) => {
        document.getElementById('status').innerText = '✅';
        calendar.removeAllEvents();
        taskListEl.innerHTML = '';

        snapshot.forEach((doc) => {
            let data = doc.data();
            let eventObj = { id: doc.id, ...data };
            calendar.addEvent(eventObj);
            renderTaskItem(eventObj);
        });
    });

    function createEvent(start, end, allDay) {
        let title = prompt('请输入日程标题:');
        if (title) addDoc(eventsCollection, { title, start, end, allDay });
    }
    function updateDbEvent(e) {
        updateDoc(doc(db, "events", e.id), { start: e.startStr, end: e.endStr, allDay: e.allDay });
    }
    function renderTaskItem(event) {
        let div = document.createElement('div');
        div.className = 'task-item'; // 记得在css里把task-item样式加回来
        div.style.padding = "10px";
        div.style.marginBottom = "5px";
        div.style.background = "white";
        div.style.borderLeft = "3px solid #4a90e2";
        div.innerHTML = `<b>${event.title}</b><br><small>${event.start.substring(0, 10)}</small>`;
        div.onclick = () => {
            calendar.changeView('rollingWeek', event.start);
        };
        taskListEl.appendChild(div);
    }
});

// =========================================
// 3. 悬浮按钮 (FAB) 拖拽与点击逻辑
// =========================================
const fab = document.getElementById('fab-container');
const fabMain = document.getElementById('fab-main');
let isDragging = false;
let startX, startY, initialLeft, initialTop;
let dragThreshold = 5; // 移动超过5像素算拖拽，否则算点击

// 鼠标/手指按下
fabMain.addEventListener('pointerdown', (e) => {
    isDragging = false;
    fab.setPointerCapture(e.pointerId); // 捕获指针，防止快速拖动丢失
    startX = e.clientX;
    startY = e.clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // 移除 bottom/right 定位，改为 left/top 以便跟随
    fab.style.bottom = 'auto';
    fab.style.right = 'auto';
    fab.style.left = initialLeft + 'px';
    fab.style.top = initialTop + 'px';

    fabMain.addEventListener('pointermove', onPointerMove);
    fabMain.addEventListener('pointerup', onPointerUp);
});

function onPointerMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // 如果移动距离够大，标记为正在拖拽
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
        isDragging = true;
        // 收起菜单
        toggleFab(false);
    }

    // 更新位置
    fab.style.left = (initialLeft + dx) + 'px';
    fab.style.top = (initialTop + dy) + 'px';
}

function onPointerUp(e) {
    fabMain.removeEventListener('pointermove', onPointerMove);
    fabMain.removeEventListener('pointerup', onPointerUp);

    // 如果不是拖拽，则是点击
    if (!isDragging) {
        toggleFab(); // 切换展开/收起
    } else {
        // 拖拽结束，可以做一些吸附边缘的逻辑（可选）
        // 这里简单处理：防止拖出屏幕
    }
}

// 切换菜单展开状态
window.toggleFab = function (forceState) {
    if (typeof forceState === 'boolean') {
        if (forceState) fab.classList.add('active');
        else fab.classList.remove('active');
    } else {
        fab.classList.toggle('active');
    }
}