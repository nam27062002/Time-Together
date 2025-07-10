# Yêu cầu: đã cài Google Cloud SDK và đã chạy `gcloud auth login` cùng `gcloud config set project time-together-e4930`

# Đường dẫn tới thư mục script (project root) -> img/male.jpg và img/female.jpg
# Thay đổi nếu cấu trúc khác

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$ImgDir = Join-Path $ProjectRoot "img"

# Tên bucket Storage
$Bucket = "gs://time-together-e4930.firebasestorage.app"

Write-Host "Uploading default avatars to $Bucket ..."

# Upload ảnh nam
$MaleSrc = Join-Path $ImgDir "male.jpg"
$MaleDest = "$Bucket/avatars/male/default.jpg"
gsutil cp "$MaleSrc" "$MaleDest"

# Upload ảnh nữ
$FemaleSrc = Join-Path $ImgDir "female.jpg"
$FemaleDest = "$Bucket/avatars/female/default.jpg"
gsutil cp "$FemaleSrc" "$FemaleDest"

Write-Host "Upload completed!" 