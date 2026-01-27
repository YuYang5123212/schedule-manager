// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// 1. 引入 Firebase 模块
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const tagsCollection = collection(db, "tags"); // 新增标签集合

document.addEventListener('DOMContentLoaded', function () {
    // 1. 初始化 FullCalendar
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        views: {
            rollingWeek: {
                type: 'timeGrid',
                duration: { days: 7 },
                dateIncrement: { days: 1 },
                buttonText: '周视'
            }
        },
        initialView: 'dayGridMonth', // 默认月历
        // 🟢 恢复顶部导航
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: '' // 留空，用 FAB 切换视图
        },
        locale: 'zh-cn',
        navLinks: true, // 允许点击日期数字
        editable: true,
        selectable: true,
        nowIndicator: true,

        // 交互逻辑
        dateClick: function (info) {
            // 点击日期 -> 切换视图
            if (calendar.view.type === 'multiMonthYear') {
                calendar.changeView('dayGridMonth', info.dateStr);
            } else if (calendar.view.type === 'dayGridMonth') {
                calendar.changeView('rollingWeek', info.dateStr);
            }
        },
        select: function (info) {
            // 只有在周视图可以通过框选新建
            if (calendar.view.type === 'rollingWeek') {
                openModal(null, info.startStr, info.endStr);
            }
        },
        eventClick: function (info) {
            openModal(info.event);
        },
        eventDrop: function (info) { updateDbEvent(info.event); },
        eventResize: function (info) { updateDbEvent(info.event); }
    });
    calendar.render();

    // ===========================================
    // 2. 标签系统逻辑
    // ===========================================
    let currentTags = [];

    // 加载标签 (从 Firebase)
    async function loadTags() {
        const q = query(tagsCollection);
        const snapshot = await getDocs(q);
        const container = document.getElementById('tags-container');
        container.innerHTML = ''; // 清空

        currentTags = [];
        snapshot.forEach(doc => {
            let t = doc.data();
            t.id = doc.id;
            currentTags.push(t);
            renderTagChip(t, container);
        });

        // 如果没有标签，添加几个默认的
        if (currentTags.length === 0) {
            addDefaultTags();
        }
    }

    function renderTagChip(tag, container) {
        let chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.style.backgroundColor = tag.color;
        chip.innerText = tag.name;
        chip.onclick = () => selectTag(chip, tag.color);
        container.appendChild(chip);
    }

    // 选中标签效果
    function selectTag(element, color) {
        // 移除其他选中状态
        document.querySelectorAll('.tag-chip').forEach(el => el.classList.remove('selected'));
        // 选中当前
        element.classList.add('selected');
        document.getElementById('selectedTagColor').value = color;
    }

    // 新建标签到云端
    window.toggleTagForm = function () {
        let form = document.getElementById('new-tag-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };

    window.addNewTag = async function () {
        let name = document.getElementById('newTagName').value;
        let color = document.getElementById('newTagColor').value;
        if (name) {
            await addDoc(tagsCollection, { name, color });
            document.getElementById('newTagName').value = '';
            toggleTagForm();
            loadTags(); // 刷新
        }
    };

    async function addDefaultTags() {
        await addDoc(tagsCollection, { name: "课程", color: "#4a90e2" });
        await addDoc(tagsCollection, { name: "考试", color: "#ff6b6b" });
        await addDoc(tagsCollection, { name: "生活", color: "#2ecc71" });
        loadTags();
    }

    // 初始化加载
    loadTags();

    // ===========================================
    // 3. 弹窗与事件保存
    // ===========================================
    const modal = document.getElementById('eventModal');

    window.openModal = function (event, start, end) {
        modal.style.display = 'flex';
        loadTags(); // 每次打开刷新标签

        if (event) {
            // 编辑模式
            document.getElementById('modalTitle').innerText = '✏️ 编辑日程';
            document.getElementById('eventTitleInput').value = event.title;
            document.getElementById('eventDescInput').value = event.extendedProps.description || '';
            document.getElementById('eventIdInput').value = event.id;
            document.getElementById('selectedTagColor').value = event.backgroundColor;
            document.getElementById('btnDelete').style.display = 'block';

            // 尝试自动选中对应颜色的标签
            setTimeout(() => {
                let chips = document.querySelectorAll('.tag-chip');
                chips.forEach(chip => {
                    // 简单的颜色匹配
                    if (chip.style.backgroundColor === event.backgroundColor) chip.classList.add('selected');
                });
            }, 100);

        } else {
            // 新建模式
            document.getElementById('modalTitle').innerText = '📅 新建日程';
            document.getElementById('eventTitleInput').value = '';
            document.getElementById('eventDescInput').value = '';
            document.getElementById('eventIdInput').value = '';
            document.getElementById('eventStartInput').value = start;
            document.getElementById('eventEndInput').value = end;
            document.getElementById('selectedTagColor').value = '#4a90e2'; // 默认色
            document.getElementById('btnDelete').style.display = 'none';
        }
    };

    window.closeModal = function () { modal.style.display = 'none'; };

    window.saveEvent = function () {
        let title = document.getElementById('eventTitleInput').value;
        let desc = document.getElementById('eventDescInput').value;
        let id = document.getElementById('eventIdInput').value;
        let color = document.getElementById('selectedTagColor').value;

        if (!title) return alert("写点什么吧");

        let data = {
            title: title,
            description: desc,
            backgroundColor: color,
            borderColor: color
        };

        if (id) {
            updateDoc(doc(db, "events", id), data);
        } else {
            data.start = document.getElementById('eventStartInput').value;
            data.end = document.getElementById('eventEndInput').value;
            data.allDay = data.start.indexOf('T') === -1;
            addDoc(eventsCollection, data);
        }
        closeModal();
    };

    window.deleteCurrentEvent = function () {
        let id = document.getElementById('eventIdInput').value;
        if (confirm("删除此日程？")) {
            deleteDoc(doc(db, "events", id));
            closeModal();
        }
    };

    // FAB 新建快捷入口
    window.openCreateModal = function () {
        let today = new Date().toISOString().split('T')[0];
        openModal(null, today, today);
        toggleFab(false);
    }

    // ===========================================
    // 4. 数据同步与渲染
    // ===========================================
    const q = query(eventsCollection, orderBy("start", "asc"));
    onSnapshot(q, (snapshot) => {
        document.getElementById('status').innerText = '✅';
        calendar.removeAllEvents();
        let taskList = document.getElementById('task-list');
        taskList.innerHTML = '';

        snapshot.forEach((doc) => {
            let data = doc.data();
            let event = { id: doc.id, ...data };
            calendar.addEvent(event);

            // 侧边栏渲染
            let div = document.createElement('div');
            div.className = 'task-item';
            div.style.borderLeftColor = data.backgroundColor;
            div.innerHTML = `
                <div style="font-weight:600">${data.title}</div>
                <div class="task-desc">${data.start.substring(0, 10)} ${data.description || ''}</div>
            `;
            div.onclick = () => {
                calendar.changeView('rollingWeek', data.start);
                // 移动端点击后滚动到顶部看日历
                if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            taskList.appendChild(div);
        });
    });

    function updateDbEvent(e) {
        updateDoc(doc(db, "events", e.id), {
            start: e.startStr, end: e.endStr, allDay: e.allDay
        });
    }

    window.changeView = function (v) {
        calendar.changeView(v);
        toggleFab(false);
    }
});

// ===========================================
// 5. 修复版 FAB 拖拽 (使用 Pointer Events)
// ===========================================
const fab = document.getElementById('fab-container');
const fabMain = document.getElementById('fab-main');
let isDragging = false;
let startX, startY, initialLeft, initialTop;

fabMain.addEventListener('pointerdown', (e) => {
    isDragging = false;
    fabMain.setPointerCapture(e.pointerId); // 锁定指针

    startX = e.clientX;
    startY = e.clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // 转换为绝对定位
    fab.style.bottom = 'auto';
    fab.style.right = 'auto';
    fab.style.left = initialLeft + 'px';
    fab.style.top = initialTop + 'px';

    fabMain.addEventListener('pointermove', onMove);
    fabMain.addEventListener('pointerup', onUp);
});

function onMove(e) {
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;

    if (isDragging) {
        fab.style.left = (initialLeft + dx) + 'px';
        fab.style.top = (initialTop + dy) + 'px';
        toggleFab(false);
    }
}

function onUp(e) {
    fabMain.removeEventListener('pointermove', onMove);
    fabMain.removeEventListener('pointerup', onUp);

    if (!isDragging) {
        toggleFab();
    }
}

window.toggleFab = function (force) {
    if (typeof force === 'boolean') {
        force ? fab.classList.add('active') : fab.classList.remove('active');
    } else {
        fab.classList.toggle('active');
    }
};