// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// 1. 引入 Firebase 模块
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventsCollection = collection(db, "events");

// 3. 初始化日历
document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');

    var calendar = new FullCalendar.Calendar(calendarEl, {
        // 视图设置：包括年(multiMonthYear), 月, 周, 列表
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'multiMonthYear,dayGridMonth,timeGridWeek,listWeek'
        },
        buttonText: {
            year: '年历',
            month: '月历',
            week: '周历',
            list: '任务清单',
            today: '今天'
        },
        locale: 'zh-cn', // 中文支持
        navLinks: true, // 点击日期可以进入当天视图
        editable: true, // 允许拖拽修改
        selectable: true, // 允许框选创建
        dayMaxEvents: true, // 事件多的时候折叠

        // --- 事件交互逻辑 ---

        // A. 点击日期/时间段：新建日程
        select: function (info) {
            let title = prompt('请输入日程标题:');
            if (title) {
                // 保存到 Firebase
                addDoc(eventsCollection, {
                    title: title,
                    start: info.startStr,
                    end: info.endStr,
                    allDay: info.allDay
                }).then(() => {
                    console.log("日程已保存到云端");
                }).catch((error) => {
                    alert("保存失败: " + error);
                });
            }
            calendar.unselect();
        },

        // B. 点击已有日程：删除 (实际应用可以做成弹窗编辑)
        eventClick: function (info) {
            if (confirm("确定要删除 '" + info.event.title + "' 吗?")) {
                // 从 Firebase 删除
                deleteDoc(doc(db, "events", info.event.id));
            }
        },

        // C. 拖拽或缩放日程：更新时间
        eventDrop: function (info) {
            updateEventInFirebase(info.event);
        },
        eventResize: function (info) {
            updateEventInFirebase(info.event);
        }
    });

    calendar.render();

    // 4. 实时监听 Firebase 数据库变化 (核心同步功能)
    // 只要数据库变了（无论是在手机上改的，还是电脑上改的），这里都会收到通知
    onSnapshot(eventsCollection, (snapshot) => {
        document.getElementById('status').innerText = '数据已同步 ' + new Date().toLocaleTimeString();

        // 清空当前日历显示，防止重复
        calendar.removeAllEvents();

        // 遍历数据库中的文档并添加到日历
        snapshot.forEach((doc) => {
            let eventData = doc.data();
            // FullCalendar 需要 id 字段来识别事件
            eventData.id = doc.id;
            calendar.addEvent(eventData);
        });
    });

    // 辅助函数：更新事件
    function updateEventInFirebase(event) {
        updateDoc(doc(db, "events", event.id), {
            start: event.startStr,
            end: event.endStr,
            allDay: event.allDay
        });
    }
});