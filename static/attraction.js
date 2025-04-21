/*---------- 基本功能：取得景點資料 ----------*/
async function getAttractionData() {
    // 從網址取得景點ID
    const id = window.location.pathname.split('/').pop();
    
    try {
      // 呼叫API取得資料
      const res = await fetch(`/api/attraction/${id}`);
      const {data} = await res.json();
      
      // 直接使用API回傳資料
      showAttraction({
        name: data.name,
        category: data.category,
        mrt: data.MRT,
        desc: data.description,
        address: data.address,
        transport: data.transport,
        images: data.images
      });
  
    } catch(err) {
      console.error('資料取得失敗', err);
    }
  }
  
  /*---------- 顯示景點內容 ----------*/
  function showAttraction(data) {
    // 基本資訊顯示
    document.getElementById('attractionName').textContent = data.name;
    document.getElementById('attractionCategory').textContent = `${data.category} at ${data.mrt}`;
  
    // 詳細資訊顯示
    document.getElementById('attractionDescription').innerHTML = data.desc;
    document.getElementById('attractionAddress').textContent = data.address;
    document.getElementById('attractionTransport').textContent = data.transport;
  
    // 初始化圖片輪播
    setupImageSlider(data.images, data.name);
  }
  
  /*---------- 圖片輪播功能 ----------*/
  function setupImageSlider(images, title) {
    const slider = document.getElementById('slideshow');

    // 產生輪播圖片
    images.forEach((img, i) => {
      slider.innerHTML += `
        <div class="slide ${i === 0 ? 'active' : ''}">
          <img src="${img}" alt="${title} 圖片 ${i+1}">
        </div>
      `;
    });
  

    // 產生指示點
    slider.insertAdjacentHTML('beforeend', `
        <div class="dots-container">
        ${images.map((_, i) => `
            <div class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
        `).join('')}
        </div>
    `);
    //控制點功能
    let current = 0;
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot'); // dots 變數
    
    // 箭頭點擊事件
    document.querySelector('.arrow.prev').addEventListener('click', () => changeSlide(-1));
    document.querySelector('.arrow.next').addEventListener('click', () => changeSlide(1));
  
    // 指示點點擊事件
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
        const index = parseInt(dot.dataset.index);
        changeSlide(index - current); // 直接跳轉到指定頁
        });
    });

    // 換頁功能 (同步更新圖片與指示點)
    function changeSlide(step) {
    // 計算新索引
    current = (current + step + slides.length) % slides.length;
    
    // 更新圖片狀態
    slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === current);
    });
    
    // 同步更新指示點狀態
    dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === current);
    });
}
}

// 預定按鈕處理
document.querySelector('.book-btn').addEventListener('click', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    document.dispatchEvent(new CustomEvent('showAuthDialog'));
    return;
  }

  // 收集表單資料
  const bookingData = {
    attractionId: window.location.pathname.split('/').pop(),
    date: document.getElementById('bookingDate').value,
    time: document.querySelector('.time-option.active').dataset.time,
    price: parseInt(document.getElementById('price').textContent)
  };

  try {
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(bookingData)
    });
    if (res.ok) window.location.href = '/booking';
  } catch (err) {
    console.error('預定失敗:', err);
  }
});

  /*---------- 時間選擇功能 ----------*/
  function setupTimeSelect() {
    const options = document.querySelectorAll('.time-option');
    
    options.forEach(btn => {
      btn.addEventListener('click', () => {
        // 移除所有選中狀態
        options.forEach(o => o.classList.remove('active'));
        // 設定當前選中
        btn.classList.add('active');
        // 更新價格顯示
        document.getElementById('price').textContent = 
          btn.dataset.time === 'morning' ? '2000' : '2500';
      });
    });
  }
  
  /*---------- 頁面初始化 ----------*/
  document.addEventListener('DOMContentLoaded', () => {
    getAttractionData();
    setupTimeSelect();
    
    // 設定日期選擇器最小日期為今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').min = today;
    document.getElementById('bookingDate').value = today;
  });

