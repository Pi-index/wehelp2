document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    // 景點瀏覽相關
    const mrtList = document.getElementById('mrtList');
    const attractionGrid = document.getElementById('attractionGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    // 使用者認證相關
    const authButton = document.getElementById('authButton');
    const authDialog = document.getElementById('authDialog');
    const closeDialogButton = document.getElementById('closeDialogButton'); // 關閉按鈕
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginError = document.getElementById('loginError');
    const signupError = document.getElementById('signupError');
    const loginSuccess = document.getElementById('loginSuccess'); // 登入成功訊息元素
    const signupSuccess = document.getElementById('signupSuccess'); // 註冊成功訊息元素

    // 狀態管理
    // 景點瀏覽狀態
    let currentPage = 0;
    let nextPage = null;
    let isLoading = false;
    let currentKeyword = '';

    // 初始化 Intersection Observer
    const sentinel = document.createElement('div');// 給予 ID 方便除錯
    sentinel.style.height = '10px';
    document.body.appendChild(sentinel);// 附加到 body 末端

    // 無限滾動觀察器()
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && nextPage !== null && !isLoading) {
                loadMoreData();
            }
        });
    }, { threshold: 0.1 });// 進入視窗 10% 時觸發

    // 初始化載入
    init();

    async function init() {
        await fetchMRTStations();
        fetchAttractions();
        observer.observe(sentinel);
        setupEventListeners();
        await checkAuthStatus(); // 新增認證狀態檢查
    }


    // ================= 事件監聽設置 =================
    function setupEventListeners() {
        // 景點瀏覽事件        
        searchBtn.addEventListener('click', handleSearch);
        mrtList.addEventListener('click', handleMRTClick);

        const scrollLeftBtn = document.getElementById('scrollLeft');
        const scrollRightBtn = document.getElementById('scrollRight');
        scrollLeftBtn.addEventListener('click', () => {
            mrtList.scrollBy({ left: -200, behavior: 'smooth' });
        }); 
        scrollRightBtn.addEventListener('click', () => {
            mrtList.scrollBy({ left: 200, behavior: 'smooth' });
        });

        // 使用者認證事件 (新增部分)
        authButton.addEventListener('click', handleAuthAction);
        closeDialogButton.addEventListener('click', hideAuthDialog); // 關閉按鈕
        authDialog.addEventListener('click', handleDialogClick);// 點擊背景關閉
        loginForm.addEventListener('submit', handleLogin);
        signupForm.addEventListener('submit', handleSignup);
        document.querySelectorAll('.switch-tab').forEach(link => {
            link.addEventListener('click', handleTabSwitch);// 連結頁切換
        });

    }
    // ================= 核心功能函式 =================
    // ================= 使用者認證功能 =================
    // 檢查使用者登入狀態
    async function checkAuthStatus() {
        // 從本地儲存取得 token
        const token = localStorage.getItem('token');
        // 如果沒有 token 直接更新為未登入狀態
        if (!token) {
            console.log("No token found, user is logged out.");
            updateAuthButton(false); 
            return;
        }
    
        try {
            // 發送認證檢查請求
            const response = await fetch('/api/user/auth', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // 處理 HTTP 狀態碼
            if (response.ok) {
                // 解析 JSON 資料
                const data = await response.json();
                // 檢查後端數據格式 (根據 API 規範調整)
                 if (data && data.data) { // 後端回傳格式可能是 { "data": { ... } }
                     console.log("User is logged in:", data.data);
                     updateAuthButton(true); // 更新按鈕狀態為已登入
                 } else {
                     console.log("Auth check successful, but no user data returned.");
                     updateAuthButton(false); // 當作未登入處理
                     localStorage.removeItem('token'); // 清除無效 token
                 }
            } else {
                console.log("Auth check failed, status:", response.status);
                updateAuthButton(false); // 更新按鈕狀態為未登入
                localStorage.removeItem('token'); // 清除無效 token
            }
        } catch (error) {
            console.error('檢查登入狀態失敗:', error);
            updateAuthButton(false); // 出錯時視為未登入
        }
    }
    

    // 更新登入按鈕文字和狀態
    function updateAuthButton(isLoggedIn) {
        if (isLoggedIn) {
            authButton.textContent = '登出系統';
            authButton.classList.add('logged-in'); // 可選，用於添加樣式
        } else {
            authButton.textContent = '登入/註冊';
            authButton.classList.remove('logged-in');
        }
    }

    // 處理認證按鈕點擊（登入或登出）
    function handleAuthAction() {
        const isLoggedIn = authButton.classList.contains('logged-in');
        if (isLoggedIn) {
            handleLogout();
        } else {
            showAuthDialog('login'); // 顯示登入頁籤
        }
    }

    // 處理登出
    function handleLogout() {
        localStorage.removeItem('token');
        updateAuthButton(false); // 更新按鈕為登入/註冊
        console.log("User logged out.");
        // 可選：顯示登出成功訊息或重新導向

    }

    // 顯示彈窗
    function showAuthDialog(defaultTab = 'login') {
        clearMessages(); // 清除之前的訊息
        loginForm.reset(); // 清空表單
        signupForm.reset(); // 清空表單
        switchAuthTab(defaultTab); // 切換到指定頁籤
        authDialog.style.display = 'flex'; // 顯示彈窗
        document.body.classList.add('no-scroll'); // 禁止背景滾動
    }

    // 隱藏彈窗
    function hideAuthDialog() {
        authDialog.style.display = 'none'; // 隱藏彈窗
        document.body.classList.remove('no-scroll'); // 恢復背景滾動
    }

    // 處理點擊彈窗背景 
    function handleDialogClick(e) {
        // 如果點擊的目標是彈窗背景本身（而不是內容區域）
        if (e.target === authDialog) {
            hideAuthDialog();
        }
    }

    // 處理頁籤切換 
    function handleTabSwitch(e) {
        e.preventDefault(); // 防止連結跳轉
        const targetTab = e.target.dataset.tab; // 獲取目標頁籤名稱 (login 或 signup)
        if (targetTab) {
            clearMessages(); // 清除訊息
            switchAuthTab(targetTab);
        }
    }

    // 切換登入/註冊頁籤的顯示
    function switchAuthTab(tabName) {
        const loginTab = document.getElementById('loginTab');
        const signupTab = document.getElementById('signupTab');
        if (tabName === 'login') {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
        } else if (tabName === 'signup') {
            loginTab.classList.remove('active');
            signupTab.classList.add('active');
        }
    }


    // 處理登入表單提交
    async function handleLogin(e) {
        e.preventDefault(); // 阻止表單預設提交行為
        clearMessages(); // 清除舊訊息
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries()); // 將 FormData 轉為物件

        try {
            const response = await fetch('/api/user/auth', {
                method: 'PUT', // 登入通常用 PUT 或 PATCH
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.token) { // 登入成功且有 token
                localStorage.setItem('token', result.token);
                console.log("Login successful, token saved.");
                // showMessage('loginSuccess', '登入成功！'); // 顯示成功訊息
                 hideAuthDialog();
                 checkAuthStatus(); // 更新按鈕狀態
                //  可選：根據需求重整頁面或導向其他頁面
                 window.location.reload();
            } else {
                // 登入失敗，顯示後端回傳的錯誤訊息，或預設訊息
                showMessage('loginError', result.message || '登入失敗，請檢查帳號或密碼。');
                console.error("Login failed:", result.message || 'Unknown error');
            }
        } catch (error) {
            showMessage('loginError', '連線錯誤，請稍後再試。');
            console.error('登入請求失敗:', error);
        }
    }

    // 處理註冊表單提交
    async function handleSignup(e) {
        e.preventDefault();
        clearMessages();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

         // 基本前端驗證 (可選)
         if (!data.name || !data.email || !data.password) {
             showMessage('signupError', '所有欄位皆為必填。');
             return;
         }
         if (data.password.length < 6) { // 假設密碼至少 6 位
             showMessage('signupError', '密碼長度至少需要 6 位。');
             return;
         }

        try {
            const response = await fetch('/api/user', { // 註冊 API 端點
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) { // HTTP 狀態碼 200-299
                 // 檢查後端是否明確表示成功 (例如 result.ok 或特定屬性)
                 // 這裡假設只要 response.ok 就代表成功
                showMessage('signupSuccess', '註冊成功！請切換至登入頁面登入。');
                console.log("Signup successful.");
                signupForm.reset(); // 清空註冊表單
                setTimeout(() => {
                    switchAuthTab('login'); // 自動切換到登入頁籤
                }, 1500); // 延遲切換，讓使用者看到成功訊息
            } else {
                // 註冊失敗，顯示後端訊息或預設訊息
                showMessage('signupError', result.message || '註冊失敗，請檢查輸入或信箱是否已被使用。');
                console.error("Signup failed:", result.message || 'Unknown error');
            }
        } catch (error) {
            showMessage('signupError', '連線錯誤，請稍後再試。');
            console.error('註冊請求失敗:', error);
        }
    }

    // ================= 工具函式 =================
    // 顯示訊息（錯誤或成功）
    function showMessage(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block'; // 顯示訊息元素
        }
    }


    // 清除所有訊息
    function clearMessages() {
        loginError.style.display = 'none';
        loginError.textContent = '';
        signupError.style.display = 'none';
        signupError.textContent = '';
        loginSuccess.style.display = 'none';
        loginSuccess.textContent = '';
        signupSuccess.style.display = 'none';
        signupSuccess.textContent = '';
    }




    // ================= 景點瀏覽相關函數 =================
    function handleMRTClick(e) {
        if (e.target.classList.contains('mrt-item')) {
            const station = e.target.textContent;
            searchInput.value = station;
            handleSearch();
        }
    }

    function handleSearch() {
        currentKeyword = searchInput.value.trim();
        currentPage = 0;
        nextPage = null;
        attractionGrid.innerHTML = '';
        fetchAttractions();
    }

    async function fetchMRTStations() {
        try {
            const res = await fetch('/api/mrts');
            const { data } = await res.json();
            renderMRTList(data);
        } catch (err) {
            console.error('取得捷運站失敗:', err);
        }
    }

    function renderMRTList(stations) {
        mrtList.innerHTML = stations
            .map(station => `<div class="mrt-item">${station}</div>`)
            .join('');
    }

    async function fetchAttractions() {
        if (isLoading) return;
        isLoading = true;

        try {
            const url = new URL('/api/attractions', window.location.origin);
            url.searchParams.set('page', currentPage);
            if (currentKeyword) url.searchParams.set('keyword', currentKeyword);

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${res.status}`);
            
            const { data, nextPage: newNextPage } = await res.json();
            renderAttractions(data);
            nextPage = newNextPage;
        } catch (err) {
            console.error('取得景點失敗:', err);
        } finally {
            isLoading = false;
        }
    }

    function renderAttractions(attractions) {
        const fragment = document.createDocumentFragment();

        attractions.forEach(attraction => {
            const mrtDisplay = attraction.MRT? attraction.MRT : '無捷運站';
            
            const card = document.createElement('a'); //使用a連結
            card.href = `/attraction/${attraction.id}`; //連結指向景點頁面           
            card.className = 'attraction-container';
            card.innerHTML = `
                <div class="attraction-image">
                    <img src="${attraction.images[0]}" alt="${attraction.name}">
                    <div class="attraction-title">${attraction.name}</div>
                </div>
                <div class="attraction-details">
                    <span class="mrt">${mrtDisplay}</span>
                    <span class="category">${attraction.category}</span>
                </div>
            `;
            fragment.appendChild(card);
        });

        attractionGrid.appendChild(fragment);
    }

    function loadMoreData() {
        if (nextPage !== null) {
            currentPage = nextPage;
            fetchAttractions();
        }
    }


});
