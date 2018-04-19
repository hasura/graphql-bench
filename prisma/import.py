import requests

ravenUrl = "http://127.0.0.1:8080/v1/query"
prismaUrl = "http://127.0.0.1:4466/Chinook/dev"

def fetchData(tableName):
    resp = requests.post(
        ravenUrl,
        headers = {
            "X-Hasura-User-Id" : "1",
            "X-Hasura-Role" : "admin"
        },
        json = {
            "type" : "select",
            "args" : {
                "table" : tableName,
                "columns" : ["*"]
            }

        }
    )
    return resp.json()

def insertData(tableName, obj):
    resp = requests.post(
        prismaUrl,
        json = {
            "operationName" : "m",
            "query" : "mutation m($d: {tn}CreateInput!) {{ create{tn}(data: $d) {{ id }} }}".format(tn=tableName),
            "variables" : {
                "d" : obj
            }
        }
    )
    jsonResp = resp.json()
    errors = jsonResp.get("errors", [])
    data = jsonResp["data"]
    if (len(errors) != 0):
        print(errors)
    return data

def copyData(rTableName, pTableName, f):
    print("copying data from {} to {}".format(rTableName, pTableName))
    rows = fetchData(rTableName)
    rowCount = len(rows)
    for i, row in enumerate(rows):
        print("- {} of {} rows".format(i, rowCount))
        insertData(pTableName, f(row))

def transformArtist(obj):
    return {
        "ArtistId" : obj["id"],
        "Name": obj["name"]
    }

def transformAlbum(obj):
    return {
        "AlbumId" : obj["id"],
        "Title": obj["title"],
        "Artist": {
            "connect" : {
                "ArtistId" : obj["artist_id"]
            }
        }
    }

def transformGenre(obj):
    return {
        "GenreId" : obj["id"],
        "Name": obj["name"]
    }

def transformMediaType(obj):
    return {
        "MediaTypeId" : obj["id"],
        "Name": obj["name"]
    }

def transformTrack(obj):
    return {
        "TrackId" : obj["id"],
        "Name": obj["name"],

        "Album": {
            "connect" : {
                "AlbumId" : obj["album_id"]
            }
        },
        "MediaType": {
            "connect" : {
                "MediaTypeId" : obj["media_type_id"]
            }
        },
        "Genre": {
            "connect" : {
                "GenreId" : obj["genre_id"]
            }
        },

        "Composer": obj["composer"],
        "Milliseconds": obj["milliseconds"],
        "Bytes": obj["bytes"],
        "UnitPrice": obj["unit_price"]
    }

copyData("artists", "Artist", transformArtist)
copyData("albums", "Album", transformAlbum)
copyData("genres", "Genre", transformGenre)
copyData("media_types", "MediaType", transformMediaType)
copyData("tracks", "Track", transformTrack)
