document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const authButton = document.getElementById('authButton');
    const authDialog = document.getElementById('authDialog');
    const closeDialogButton = document.getElementById('closeDialogButton');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // 狀態檢查函式
    async function checkAuthStatus() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/auth', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const isLoggedIn = !!result.data;

            // 更新按鈕狀態
            authButton.textContent = isLoggedIn ? '登出系統' : '登入/註冊';
            authButton.classList.toggle('logged-in', isLoggedIn);

            // 同步 token 狀態
            if (isLoggedIn !== !!localStorage.getItem('token')) {
                localStorage.setItem('token', isLoggedIn ? token : '');
            }
        } catch (error) {
            console.error('認證狀態檢查失敗:', error);
            localStorage.removeItem('token');
            updateAuthButton(false);
        }
    }

    // 按鈕狀態更新
    function updateAuthButton(isLoggedIn) {
        authButton.textContent = isLoggedIn ? '登出系統' : '登入/註冊';
        authButton.classList.toggle('logged-in', isLoggedIn);
    }

    // 對話框控制
    function showAuthDialog(defaultTab = 'login') {
        switchAuthTab(defaultTab);
        authDialog.style.display = 'flex';
        document.body.classList.add('no-scroll');
    }

    function hideAuthDialog() {
        authDialog.style.display = 'none';
        document.body.classList.remove('no-scroll');
        clearMessages();
    }

    // 頁籤切換
    function switchAuthTab(tabName) {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.style.display = tab.id === `${tabName}Tab` ? 'block' : 'none';
        });
    }

    // 訊息處理
    function clearMessages() {
        document.querySelectorAll('.error-message, .success-message').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    function showMessage(elementId, message, isSuccess = false) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
            el.style.color = isSuccess ? '#28a745' : '#dc3545';
        }
    }

    // 登入處理
    async function handleLogin(e) {
        e.preventDefault();
        clearMessages();

        try {
            const formData = new FormData(e.target);
            const response = await fetch('/api/user/auth', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            const result = await response.json();

            if (response.ok && result.token) {
                localStorage.setItem('token', result.token);
                hideAuthDialog();
                checkAuthStatus();
                window.location.reload();
            } else {
                showMessage('loginError', result.message || '登入失敗，請檢查帳號或密碼');
            }
        } catch (error) {
            showMessage('loginError', '連線錯誤，請稍後再試');
        }
    }

    // 註冊處理
    async function handleSignup(e) {
        e.preventDefault();
        clearMessages();

        try {
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);

            // 前端驗證
            if (!data.name || !data.email || !data.password) {
                return showMessage('signupError', '所有欄位皆為必填');
            }
            if (data.password.length < 6) {
                return showMessage('signupError', '密碼長度至少需要 6 位');
            }

            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage('signupSuccess', '註冊成功！請登入', true);
                signupForm.reset();
                setTimeout(() => switchAuthTab('login'), 1500);
            } else {
                showMessage('signupError', result.message || '註冊失敗');
            }
        } catch (error) {
            showMessage('signupError', '連線錯誤，請稍後再試');
        }
    }

    // 登出處理
    function handleLogout() {
        localStorage.removeItem('token');
        checkAuthStatus();
        window.location.reload();
    }

    // 事件綁定
    function setupEventListeners() {
        // 認證按鈕
        if (authButton) {
            authButton.addEventListener('click', () => {
                authButton.classList.contains('logged-in') ? handleLogout() : showAuthDialog();
            });
        }

        // 關閉按鈕
        if (closeDialogButton) {
            closeDialogButton.addEventListener('click', hideAuthDialog);
        }

        // 背景點擊
        if (authDialog) {
            authDialog.addEventListener('click', (e) => {
                if (e.target === authDialog) hideAuthDialog();
            });
        }

        // 頁籤切換
        document.querySelectorAll('.switch-tab').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchAuthTab(e.target.dataset.tab);
            });
        });

        // 表單提交
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        if (signupForm) {
            signupForm.addEventListener('submit', handleSignup);
        }
    }

    // 初始化
    function init() {
        setupEventListeners();
        checkAuthStatus();
        window.addEventListener('storage', (e) => {
            if (e.key === 'token') checkAuthStatus();
        });
    }

    init();
});