document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const mrtList = document.getElementById('mrtList');
    const attractionGrid = document.getElementById('attractionGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    // 狀態管理
    let currentPage = 0;
    let nextPage = null;
    let isLoading = false;
    let currentKeyword = '';

    // 初始化 Intersection Observer
    const sentinel = document.createElement('div');
    sentinel.style.height = '10px';
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && nextPage !== null && !isLoading) {
                loadMoreData();
            }
        });
    }, { threshold: 0.1 });

    // 初始化載入
    init();

    async function init() {
        await fetchMRTStations();
        fetchAttractions();
        observer.observe(sentinel);
        setupEventListeners();
    }

    function setupEventListeners() {
        searchBtn.addEventListener('click', handleSearch);
        mrtList.addEventListener('click', handleMRTClick);
        
        // 滾動按鈕功能
        const scrollLeftBtn = document.getElementById('scrollLeft');
        const scrollRightBtn = document.getElementById('scrollRight');
        
        scrollLeftBtn.addEventListener('click', () => {
            mrtList.scrollBy({ left: -200, behavior: 'smooth' });
        });
        
        scrollRightBtn.addEventListener('click', () => {
            mrtList.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }

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