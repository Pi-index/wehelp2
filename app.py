from fastapi import *
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles  # 新增這行
import mysql.connector.pooling
import json
import jwt  # 新增 JWT 相關套件
from datetime import datetime, timedelta  # 處理 Token 過期時間
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # 處理 Bearer Token
from typing import Optional


app = FastAPI()

# 設定 JWT 參數
JWT_SECRET = "your-secret-key"  # 生產環境應使用更安全的密鑰並從環境變數讀取
JWT_ALGORITHM = "HS256"


app.mount("/static", StaticFiles(directory="static"), name="static")

# 過濾圖片 URL
def filter_image_urls(url):
    allow_url = (".jpg", ".png")
    filtered_urls = []
    url_list = url.split("https://")
    for url in url_list:
        if not url:
            continue
        if url.lower().endswith(allow_url):
            filtered_urls.append("https://" + url)
    return filtered_urls

# MySQL 連線池設定
db_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="my_pool",
    pool_size=5,  # 連線池大小
    host="localhost",
    user="root",
    password="12345678",
    database="taipei_travel"
)

# 讀取 JSON 並存入 MySQL
def load_json_to_db():
    try:
        with open("data/taipei-attractions.json", "r", encoding="utf-8") as file:
            data = json.load(file)
        attractions = data["result"]["results"]

        conn = db_pool.get_connection()
        cursor = conn.cursor()
        print("資料庫連線成功")

        # 檢查 major 表格是否為空
        cursor.execute("SELECT COUNT(*) as total FROM major")
        if cursor.fetchone()[0] == 0:
            for attraction in attractions:
                images = filter_image_urls(attraction["file"])
                # 插入 major
                sql_major = """
                INSERT INTO major (
                    name, CAT, description, address, direction, MRT, SERIAL_NO, date, longitude, latitude, images
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values_major = (
                    attraction["name"],
                    attraction.get("CAT"),
                    attraction.get("description"),
                    attraction.get("address"),
                    attraction.get("direction"),
                    attraction.get("MRT"),
                    attraction.get("SERIAL_NO"),
                    attraction.get("date"),  # 直接使用原始字串
                    attraction.get("longitude"), 
                    attraction.get("latitude"),  
                    json.dumps(images)  # 將圖片 URL 列表轉為 JSON 字串
                )
                cursor.execute(sql_major, values_major)

                # 插入 minor
                sql_minor = """
                INSERT INTO minor (
                    REF_WP, avBegin, avEnd, langinfo, SERIAL_NO, RowNumber, MEMO_TIME, POI
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                values_minor = (
                    attraction.get("REF_WP"),
                    attraction.get("avBegin"),  # 直接使用原始字串
                    attraction.get("avEnd"),    # 直接使用原始字串
                    attraction.get("langinfo"),
                    attraction.get("SERIAL_NO"),
                    attraction.get("RowNumber"),
                    attraction.get("MEMO_TIME"),
                    attraction.get("POI")
                )
                cursor.execute(sql_minor, values_minor)

            conn.commit()
            print("資料已匯入")
        else:
            print("資料已存在，跳過匯入")

        # cursor.close()
        # conn.close()  # 歸還連接至連線池
    except Exception as e:
        print(f"資料匯入失敗: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# 第一次執行時匯入資料
load_json_to_db()

# API 路由: 取得所有景點
@app.get("/api/attractions")
async def get_attractions(page: int = 0, keyword: str = None):
    try:
        conn = db_pool.get_connection()
        print("api連線成功")
        cursor = conn.cursor(dictionary=True)  # 設置為字典格式
        limit = 12  # 每頁 12 筆資料
        offset = page * limit

        # 查詢景點總數
        if keyword:
            count_query = """
            SELECT COUNT(*) as total FROM major
            WHERE name LIKE %s OR MRT=%s
            """
            cursor.execute(count_query, (f"%{keyword}%", keyword))
        else:
            count_query = "SELECT COUNT(*) as total FROM major"
            cursor.execute(count_query)

        total = cursor.fetchone()["total"]

        # 查詢景點資料
        if keyword:
            query = """
            SELECT id, name, CAT as category, description, address, direction as transport, MRT, latitude as lat, longitude as ing, images
            FROM major
            WHERE name LIKE %s OR MRT=%s
            LIMIT %s OFFSET %s
            """
            cursor.execute(query, (f"%{keyword}%", keyword, limit, offset))
        else:
            query = """
            SELECT id, name, CAT as category, description, address, direction as transport, MRT, latitude as lat, longitude as ing, images
            FROM major
            LIMIT %s OFFSET %s
            """
            cursor.execute(query, (limit, offset))

        attractions = cursor.fetchall()
        for attraction in attractions:
            attraction["images"] = json.loads(attraction["images"])  # 將 JSON 字串轉為陣列

        # 計算下一頁的頁碼
        next_page = page + 1 if (offset + limit) < total else None

        # cursor.close()
        # conn.close()  # 歸還連接至連線池
        return JSONResponse(content={"nextPage": next_page, "data": attractions})
    except Exception as e:
        print(f"發生錯誤: {e}")  # 打印錯誤訊息
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# API 路由: 根據 ID 取得單一景點
@app.get("/api/attraction/{attractionId}")
async def get_attraction(attractionId: int):
    try:
        conn = db_pool.get_connection()
        print("api連線成功")
        cursor = conn.cursor(dictionary=True)  # 設置為字典格式

        query = """
		SELECT id, name, CAT as category, description, address, direction as transport, MRT, latitude as lat, longitude as ing, images
		FROM major
        WHERE id = %s
        """
        cursor.execute(query, (attractionId,))
        attraction = cursor.fetchone()

        if not attraction:
            return JSONResponse(
                content={"error": True, "message": "景點編號不正確"},
                status_code=400
            )

        # 將 images 欄位從 JSON 字串轉為陣列
        attraction["images"] = json.loads(attraction["images"])

        # cursor.close()
        # conn.close()  # 歸還連接至連線池
        return JSONResponse(content={"data": attraction})

    except Exception as e:
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# API 路由: 取得 MRT 列表
@app.get("/api/mrts")
async def get_mrts():
    try:
        conn = db_pool.get_connection()
        print("api連線成功")
        cursor = conn.cursor(dictionary=True)  # 設置為字典格式

        # 查詢 MRT 站名，按景點數量由大到小排序
        query = """
        SELECT MRT FROM major
        WHERE MRT IS NOT NULL AND MRT != ''
        GROUP BY MRT
        ORDER BY COUNT(*) DESC
        """
        cursor.execute(query)
        mrts = [row["MRT"] for row in cursor.fetchall()]  # 以陣列格式回傳

        # cursor.close()
        # conn.close()  # 歸還連接至連線池
        return JSONResponse(content={"data": mrts})
    except Exception as e:
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# 註冊會員 API    - 檢查 Email 是否重複    - 將會員資料寫入資料庫
@app.post("/api/user")
async def register_user(request: Request):

    try:
        data = await request.json()
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")

        # 檢查必填欄位
        if not all([name, email, password]):
            return JSONResponse(
                content={"error": True, "message": "請填妥姓名電子郵件及密碼資料"},
                status_code=400
            )

        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 檢查 Email 是否已存在
        cursor.execute("SELECT email FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return JSONResponse(
                content={"error": True, "message": "註冊失敗，重複的 Email"},
                status_code=400
            )
        
        # 插入新用戶（加密密碼尚待研究）
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
            (name, email, password)
        )
        conn.commit()

        return JSONResponse(content={"ok": True}, status_code=200)

    except Exception as e:
        print(f"註冊失敗: {str(e)}")
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        cursor.close()
        conn.close()

# 登入會員 API    - 驗證帳號密碼    - 成功時回傳 JWT Token
@app.put("/api/user/auth")
async def login_user(request: Request):

    try:
        data = await request.json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return JSONResponse(
                content={"error": True, "message": "請輸入電子信箱及密碼"},
                status_code=400
            )

        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        # 驗證用戶是否存在且密碼正確
        if not user or user["password"] != password:
            return JSONResponse(
                content={"error": True, "message": "登入失敗：帳號或密碼錯誤"},
                status_code=400
            )

        # 生成 JWT Token（有效期 7 天）
        token_payload = {
            "user_id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return JSONResponse(content={"token": token}, status_code=200)

    except Exception as e:
        print(f"登入失敗: {str(e)}")
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        cursor.close()
        conn.close()

# 驗證 Token 的依賴函式
security = HTTPBearer()
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    從 Authorization Header 提取並驗證 JWT Token
    - 成功時回傳用戶資料
    - 失敗時回傳 None
    """
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # 從資料庫確認用戶存在
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email FROM users WHERE id = %s", (payload["user_id"],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        return user if user else None
    except:
        return None
    
# 取得當前會員資訊 API    - 未登入時回傳 null
@app.get("/api/user/auth")
async def get_user_info(current_user: dict = Depends(get_current_user)):

    if current_user:
        return JSONResponse(content={
            "data": { 
                "id": current_user["id"],
                "name": current_user["name"],
                "email": current_user["email"]
            }
        })
    else:
        return JSONResponse(content={"data": None})  # 未登入回傳 nul
    

@app.post("/api/booking")
async def create_booking(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Part 5-1: 建立預定行程 (嚴格符合 API 規格)
    """
    if not current_user:
        return JSONResponse(
            content={"error": True, "message": "未登入系統，拒絕存取"},
            status_code=403
        )

    try:
        data = await request.json()
        # 僅檢查必要欄位存在性 (依規格要求)
        required_fields = ["attractionId", "date", "time", "price"]
        if not all(field in data for field in required_fields):
            return JSONResponse(
                content={"error": True, "message": "輸入資料不完整"},
                status_code=400
            )

        # 直接使用參數 (不進行格式驗證)
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        
        # 實現替換邏輯 (依規格要求)
        conn.start_transaction()
        cursor.execute(
            "DELETE FROM bookings WHERE user_id = %s",
            (current_user["id"],)
        )
        cursor.execute(
            """
            INSERT INTO bookings 
            (user_id, attraction_id, date, time, price)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                current_user["id"],
                data["attractionId"],
                data["date"],
                data["time"],
                data["price"]
            )
        )

        conn.commit()
        return JSONResponse(content={"ok": True})  # 依規格範例格式

    except Exception as e:
        conn.rollback()
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

# 取得預定行程 API      
@app.get("/api/booking")
async def get_booking(
    current_user: dict = Depends(get_current_user)
):
    """
    Part 5-1: 取得預定行程 (嚴格符合 API 規格)
    """
    if not current_user:
        return JSONResponse(
            content={"error": True, "message": "未登入系統，拒絕存取"},
            status_code=403
        )

    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                b.attraction_id,
                b.date,
                b.time,
                b.price,
                m.name as attraction_name,
                m.address,
                m.images
            FROM bookings b
            JOIN major m ON b.attraction_id = m.id
            WHERE b.user_id = %s
            ORDER BY b.created_at DESC
            LIMIT 1
        """, (current_user["id"],))
        
        booking = cursor.fetchone()

        # 完全對應規格範例格式
        return JSONResponse(content={
            "data": {
                "attraction": {
                    "id": booking["attraction_id"],
                    "name": booking["attraction_name"],
                    "address": booking["address"],
                    "image": json.loads(booking["images"])[0]
                },
                "date": booking["date"].strftime("%Y-%m-%d"),
                "time": booking["time"],
                "price": booking["price"]
            } if booking else None
        })

    except Exception as e:
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

@app.delete("/api/booking")
async def delete_booking(
    current_user: dict = Depends(get_current_user)
):
    """
    Part 5-1: 刪除預定行程 (嚴格符合 API 規格)
    """
    if not current_user:
        return JSONResponse(
            content={"error": True, "message": "未登入系統，拒絕存取"},
            status_code=403
        )

    try:
        conn = db_pool.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "DELETE FROM bookings WHERE user_id = %s",
            (current_user["id"],)
        )
        conn.commit()
        
        return Response(status_code=200)  # 依規格範例格式

    except Exception as e:
        conn.rollback()
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

# Static Pages (Never Modify Code in this Block)
@app.get("/", include_in_schema=False)
async def index(request: Request):
    return FileResponse("./static/index.html", media_type="text/html")

@app.get("/attraction/{id}", include_in_schema=False)
async def attraction(request: Request, id: int):
    return FileResponse("./static/attraction.html", media_type="text/html")

@app.get("/booking", include_in_schema=False)
async def booking(request: Request):
    return FileResponse("./static/booking.html", media_type="text/html")

@app.get("/thankyou", include_in_schema=False)
async def thankyou(request: Request):
    return FileResponse("./static/thankyou.html", media_type="text/html")