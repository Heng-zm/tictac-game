Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Ozo\.gemini\antigravity-ide\brain\ff9a34e9-1f7b-435f-8088-e3e86ea7d121\game_app_icon_1792686905971.jpg"
$src = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($width, $height, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(12, 13, 22))
    $g.DrawImage($src, 0, 0, $width, $height)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $destPath"
}

function Create-Maskable($destPath) {
    $bmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(12, 13, 22))
    $inset = 32
    $innerSize = 512 - ($inset * 2)
    $g.DrawImage($src, $inset, $inset, $innerSize, $innerSize)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $destPath"
}

Resize-Image 512 512 "c:\Users\Ozo\Downloads\tictac-game\public\icons\icon-512.png"
Resize-Image 192 192 "c:\Users\Ozo\Downloads\tictac-game\public\icons\icon-192.png"
Resize-Image 180 180 "c:\Users\Ozo\Downloads\tictac-game\public\icons\apple-touch-icon.png"
Create-Maskable "c:\Users\Ozo\Downloads\tictac-game\public\icons\icon-maskable-512.png"

$bytes = [System.IO.File]::ReadAllBytes("c:\Users\Ozo\Downloads\tictac-game\public\icons\icon-192.png")
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
[System.IO.File]::WriteAllText("c:\Users\Ozo\Downloads\tictac-game\public\favicon.svg", $svgContent)
Write-Host "Created: favicon.svg"

$src.Dispose()
Write-Host "All icons generated successfully!"
