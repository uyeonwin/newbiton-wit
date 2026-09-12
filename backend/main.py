import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


load_dotenv()


KAKAO_REST_KEY = os.getenv("KAKAO_REST_KEY", "").strip()
ODSAY_API_KEY = os.getenv("ODSAY_API_KEY", "").strip()

app = FastAPI(title="WiT Backend", version="1.0.0")

# 개발 중 편의를 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 발급받으신 API 키
ODSAY_API_KEY = os.getenv("ODSAY_API_KEY")
KAKAO_REST_KEY = os.getenv("KAKAO_REST_KEY")
KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
ODSAY_ROUTE_URL = "https://api.odsay.com/v1/api/searchPubTransPathT"


class LocationInput(BaseModel):
    address: Optional[str] = None
    x: Optional[float] = None  # 경도
    y: Optional[float] = None  # 위도


class RouteRequest(BaseModel):
    start: LocationInput
    end: LocationInput


def kakao_headers():
    if not KAKAO_REST_KEY:
        raise HTTPException(
            status_code=500,
            detail="KAKAO_REST_KEY가 설정되지 않았습니다. backend/.env를 확인하세요.",
        )
    return {"Authorization": f"KakaoAK {KAKAO_REST_KEY}"}


async def kakao_address_search(client: httpx.AsyncClient, query: str):
    response = await client.get(
        KAKAO_ADDRESS_URL,
        headers=kakao_headers(),
        params={"query": query},
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"카카오 주소 검색 오류: {response.status_code} / {response.text}",
        )

    return response.json().get("documents", [])


async def kakao_keyword_search(client: httpx.AsyncClient, query: str):
    response = await client.get(
        KAKAO_KEYWORD_URL,
        headers=kakao_headers(),
        params={"query": query},
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"카카오 키워드 검색 오류: {response.status_code} / {response.text}",
        )

    return response.json().get("documents", [])


def normalize_address_document(doc: dict):
    return {
        "place_name": (
            doc.get("place_name")
            or (doc.get("road_address") or {}).get("building_name")
            or doc.get("address_name")
            or ""
        ),
        "address_name": (
            doc.get("road_address_name")
            or doc.get("address_name")
            or (doc.get("road_address") or {}).get("address_name")
            or (doc.get("address") or {}).get("address_name")
            or ""
        ),
        "x": float(doc["x"]),
        "y": float(doc["y"]),
    }


async def resolve_location(client: httpx.AsyncClient, location: LocationInput):
    # 사용자가 집/학교를 검색해서 저장한 경우 좌표를 그대로 사용
    if location.x is not None and location.y is not None:
        return {
            "address": location.address or "",
            "x": float(location.x),
            "y": float(location.y),
        }

    query = (location.address or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="주소 또는 좌표가 필요합니다.")

    # 알바 공고의 '서울 강남구 논현동' 같은 행정주소는 주소 검색을 우선
    address_docs = await kakao_address_search(client, query)

    if address_docs:
        doc = address_docs[0]
        return {
            "address": (
                doc.get("road_address_name")
                or doc.get("address_name")
                or (doc.get("road_address") or {}).get("address_name")
                or (doc.get("address") or {}).get("address_name")
                or query
            ),
            "x": float(doc["x"]),
            "y": float(doc["y"]),
        }

    # '고려대학교', '강남역' 같은 장소명은 키워드 검색
    keyword_docs = await kakao_keyword_search(client, query)

    if keyword_docs:
        doc = keyword_docs[0]
        return {
            "address": (
                doc.get("road_address_name")
                or doc.get("address_name")
                or query
            ),
            "x": float(doc["x"]),
            "y": float(doc["y"]),
        }

    raise HTTPException(
        status_code=404,
        detail=f"카카오에서 위치를 찾지 못했습니다: {query}",
    )


@app.get("/health")
async def health():
    return {
        "ok": True,
        "kakao_key_loaded": bool(KAKAO_REST_KEY),
        "odsay_key_loaded": bool(ODSAY_API_KEY),
    }


@app.get("/api/search-address")
async def search_address(
    query: str = Query(..., min_length=1, description="검색할 주소/장소명")
):
    query = query.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 사용자가 '고려대학교' 같은 장소명을 많이 입력하므로 키워드 검색을 먼저 표시
        keyword_docs = await kakao_keyword_search(client, query)
        address_docs = await kakao_address_search(client, query)

    results = []
    seen = set()

    for doc in keyword_docs:
        item = normalize_address_document(doc)
        key = (round(item["x"], 6), round(item["y"], 6))
        if key not in seen:
            seen.add(key)
            results.append(item)

    for doc in address_docs:
        item = normalize_address_document(doc)
        key = (round(item["x"], 6), round(item["y"], 6))
        if key not in seen:
            seen.add(key)
            results.append(item)

    return {"results": results[:10]}


@app.post("/api/route")
async def route(req: RouteRequest):
    if not ODSAY_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ODSAY_API_KEY가 설정되지 않았습니다. backend/.env를 확인하세요.",
        )

    async with httpx.AsyncClient(timeout=20.0) as client:
        start = await resolve_location(client, req.start)
        end = await resolve_location(client, req.end)

        response = await client.get(
            ODSAY_ROUTE_URL,
            params={
                "apiKey": ODSAY_API_KEY,
                "SX": start["x"],
                "SY": start["y"],
                "EX": end["x"],
                "EY": end["y"],
                "OPT": 0,
                "SearchType": 0,
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ODsay HTTP 오류: {response.status_code} / {response.text}",
        )

    data = response.json()

    if data.get("error"):
        raise HTTPException(
            status_code=502,
            detail=f"ODsay 오류: {data['error']}",
        )

    paths = (data.get("result") or {}).get("path") or []

    if not paths:
        raise HTTPException(
            status_code=404,
            detail="ODsay에서 대중교통 경로를 찾지 못했습니다.",
        )

    # OPT=0 추천/최단 경로의 첫 결과
    info = paths[0].get("info") or {}

    try:
        total_time = int(info.get("totalTime", 0))
        payment = int(info.get("payment", 0))
        total_distance = int(info.get("totalDistance", 0))
        total_walk = int(info.get("totalWalk", 0))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=502,
            detail=f"ODsay 응답 형식이 예상과 다릅니다: {info}",
        )

    if total_time <= 0:
        raise HTTPException(
            status_code=502,
            detail=f"ODsay가 유효한 이동시간을 반환하지 않았습니다: {info}",
        )

    return {
        "time": total_time,
        "cost": payment,
        "distance_m": total_distance,
        "distance_km": round(total_distance / 1000, 1),
        "walk_m": total_walk,
        "first_station": info.get("firstStartStation", ""),
        "last_station": info.get("lastEndStation", ""),
        "start": start,
        "end": end,
    }
