Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path "$scriptDir\..").Path
$publicIconsDir = Join-Path $repoRoot "public\icons"
$faviconPath = Join-Path $repoRoot "public\favicon.svg"

$defaultSrc = "C:\Users\hengk\.gemini\antigravity-cli\brain\62d2d946-eff6-4aaf-a1aa-aac5b5c1c12d\tictactoe_app_icon_1794816128047.jpg"
$srcPath = if ($args.Count -gt 0) { $args[0] } else { $defaultSrc }

if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found at $srcPath"
    exit 1
}

$src = [System.Drawing.Image]::FromFile($srcPath)

# Optimal crop centered around the squircle app badge
$cropSize = 860
$cropX = [int](512 - ($cropSize / 2))
$cropY = [int](507 - ($cropSize / 2))
$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)

function Resize-Image($sourceImage, $sourceRect, $width, $height, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(2, 11, 16))
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $g.DrawImage($sourceImage, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $destPath"
}

function Create-Maskable($sourceImage, $sourceRect, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(2, 11, 16))
    # Android maskable safe zone is inner 80% circle (diameter 409px)
    $inset = 44
    $innerSize = 512 - ($inset * 2)
    $destRect = New-Object System.Drawing.Rectangle($inset, $inset, $innerSize, $innerSize)
    $g.DrawImage($sourceImage, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $destPath"
}

if (-not (Test-Path $publicIconsDir)) {
    New-Item -ItemType Directory -Force -Path $publicIconsDir | Out-Null
}

$icon512 = Join-Path $publicIconsDir "icon-512.png"
$icon192 = Join-Path $publicIconsDir "icon-192.png"
$iconApple = Join-Path $publicIconsDir "apple-touch-icon.png"
$iconMaskable = Join-Path $publicIconsDir "icon-maskable-512.png"

Resize-Image $src $srcRect 512 512 $icon512
Resize-Image $src $srcRect 192 192 $icon192
Resize-Image $src $srcRect 180 180 $iconApple
Create-Maskable $src $srcRect $iconMaskable

# Generate SVG favicon with embedded base64 of icon-192
$bytes = [System.IO.File]::ReadAllBytes($icon192)
$base64 = [Convert]::ToBase64String($bytes)
$svgContent = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Tic Tac Toe">
  <defs>
    <clipPath id="tile">
      <rect width="512" height="512" rx="116" />
    </clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <image href="data:image/png;base64,$base64" width="512" height="512" preserveAspectRatio="xMidYMid slice" />
  </g>
</svg>
"@

[System.IO.File]::WriteAllText($faviconPath, $svgContent)
Write-Host "Created: $faviconPath"

# If dist exists, mirror to dist as well
$distIconsDir = Join-Path $repoRoot "dist\client\icons"
$distFavicon = Join-Path $repoRoot "dist\client\favicon.svg"
if (Test-Path $distIconsDir) {
    Copy-Item -Path "$publicIconsDir\*" -Destination $distIconsDir -Force
    Write-Host "Updated dist icons"
}
if (Test-Path (Split-Path -Parent $distFavicon)) {
    Copy-Item -Path $faviconPath -Destination $distFavicon -Force
    Write-Host "Updated dist favicon"
}

$src.Dispose()
Write-Host "All game icons updated successfully!"
