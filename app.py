from fastapi import *
from fastapi.responses import FileResponse, JSONResponse
import mysql.connector.pooling
import json

app=FastAPI()

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

        cursor.close()
        conn.close()  # 歸還連接至連線池
    except Exception as e:
        print(f"資料匯入失敗: {str(e)}")

# 第一次執行時匯入資料
load_json_to_db()

# API 路由: 取得所有景點
@app.get("/api/attractions")
async def get_attractions(page: int = 0, keyword: str = None):
    try:
        conn=db_pool.get_connection()
        print("api連線成功")
        cursor=conn.cursor(dictionary=True)  # 設置為字典格式
        limit=12  # 每頁 12 筆資料
        offset=page * limit

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

        attractions=cursor.fetchall()
        for attraction in attractions:
            attraction["images"] = json.loads(attraction["images"])  # 將 JSON 字串轉為陣列

        # 計算下一頁的頁碼
        next_page=page + 1 if (offset + limit) < total else None

        cursor.close()
        conn.close()  # 歸還連接至連線池
        return JSONResponse(content={"nextPage": next_page, "data": attractions})
    except Exception as e:
        print(f"發生錯誤: {e}")  # 打印錯誤訊息
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )

# API 路由: 根據 ID 取得單一景點
@app.get("/api/attraction/{attractionId}")
async def get_attraction(attractionId: int):
    try:
        conn=db_pool.get_connection()
        print("api連線成功")
        cursor=conn.cursor(dictionary=True)  # 設置為字典格式

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

        cursor.close()
        conn.close()  # 歸還連接至連線池
        return JSONResponse(content={"data": attraction})

    except Exception as e:
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )

# API 路由: 取得 MRT 列表
@app.get("/api/mrts")
async def get_mrts():
    try:
        conn=db_pool.get_connection()
        print("api連線成功")
        cursor=conn.cursor(dictionary=True)  # 設置為字典格式

        # 查詢 MRT 站名，按景點數量由大到小排序
        query = """
        SELECT MRT FROM major
        WHERE MRT IS NOT NULL AND MRT != ''
        GROUP BY MRT
        ORDER BY COUNT(*) DESC
        """
        cursor.execute(query)
        mrts=[row["MRT"] for row in cursor.fetchall()]  # 以陣列格式回傳

        cursor.close()
        conn.close()  # 歸還連接至連線池
        return JSONResponse(content={"data": mrts})
    except Exception as e:
        return JSONResponse(
            content={"error": True, "message": "伺服器內部錯誤"},
            status_code=500
        )

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