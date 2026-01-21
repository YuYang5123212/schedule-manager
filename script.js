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

    // 初始化 FullCalendar
    var calendar = new FullCalendar.Calendar(calendarEl, {
        // 初始视图：多月视图（年历模式）
        initialView: 'multiMonthYear',
        multiMonthMaxColumns: 2, // 电脑上显示两列（更像校历），手机自动调整

        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: '' // 按钮我们自己做在上面的 HTML 里了，这里留空让界面更干净
        },
        locale: 'zh-cn',
        navLinks: false, // 关闭默认跳转，我们自己写逻辑
        editable: true,
        selectable: true,
        dayMaxEvents: false, // 年历模式下，尽量显示圆点或简写

        // ==========================================
        // 🟢 核心交互：下钻逻辑 (Drill-down)
        // ==========================================
        dateClick: function (info) {
            // 获取当前视图类型
            let currentView = calendar.view.type;

            if (currentView === 'multiMonthYear') {
                // 如果在年历，点击任何日期 -> 进入该月的月历
                calendar.changeView('dayGridMonth', info.dateStr);
                document.getElementById('btn-overview').classList.remove('active');
                document.getElementById('btn-detail').classList.add('active');
            } else if (currentView === 'dayGridMonth') {
                // 如果在月历，点击日期 -> 进入周历（或者新建日程，看你习惯）
                // 这里我们设定：单击空白处询问是否新建，避免误触
            }
        },

        // 选中日期新建
        select: function (info) {
            // 只有在非年历模式下才允许拖拽新建，防止在年视图误操作
            if (calendar.view.type !== 'multiMonthYear') {
                createEvent(info.startStr, info.endStr, info.allDay);
            }
        },

        // 点击事件删除
        eventClick: function (info) {
            if (confirm("删除日程: " + info.event.title + "?")) {
                deleteDoc(doc(db, "events", info.event.id));
            }
        },

        // 拖拽更新
        eventDrop: function (info) { updateDbEvent(info.event); },
        eventResize: function (info) { updateDbEvent(info.event); }
    });

    // 挂载到全局，方便 HTML 按钮调用
    window.calendarAPI = calendar;
    window.manualAddEvent = function () {
        let title = prompt("请输入日程内容:");
        if (title) {
            // 默认加在今天
            let today = new Date().toISOString().split('T')[0];
            addDoc(eventsCollection, {
                title: title,
                start: today,
                end: today,
                allDay: true
            });
        }
    };

    calendar.render();

    // ==========================================
    // 🔵 数据库同步 (修复手机端问题)
    // ==========================================
    // 使用 query 和 orderBy 确保顺序一致
    const q = query(eventsCollection, orderBy("start", "asc"));

    onSnapshot(q, (snapshot) => {
        document.getElementById('status').innerText = '✅ 数据已同步';
        document.getElementById('status').style.color = 'green';

        // 1. 更新日历
        calendar.removeAllEvents();

        // 2. 清空侧边栏任务列表
        taskListEl.innerHTML = '';

        snapshot.forEach((doc) => {
            let data = doc.data();
            let eventObj = {
                id: doc.id,
                title: data.title,
                start: data.start,
                end: data.end,
                allDay: data.allDay
            };

            // 添加到日历
            calendar.addEvent(eventObj);

            // 添加到右侧列表 (只显示未来的，或者最近的)
            renderTaskItem(eventObj);
        });
    }, (error) => {
        document.getElementById('status').innerText = '❌ 同步失败';
        console.error("Sync error:", error);
    });

    // 辅助：渲染侧边栏列表项
    function renderTaskItem(event) {
        let div = document.createElement('div');
        div.className = 'task-item';
        // 格式化日期
        let dateStr = event.start;
        div.innerHTML = `
            <span class="task-date">${dateStr}</span>
            <span class="task-title">${event.title}</span>
        `;
        div.onclick = () => {
            // 点击列表，日历跳转到那一天
            calendar.gotoDate(event.start);
            calendar.changeView('dayGridMonth');
        };
        taskListEl.appendChild(div);
    }

    // 辅助：创建
    function createEvent(start, end, allDay) {
        let title = prompt('请输入日程标题:');
        if (title) {
            addDoc(eventsCollection, {
                title: title,
                start: start,
                end: end,
                allDay: allDay
            });
        }
    }

    // 辅助：更新
    function updateDbEvent(event) {
        updateDoc(doc(db, "events", event.id), {
            start: event.startStr,
            end: event.endStr,
            allDay: event.allDay
        });
    }
});