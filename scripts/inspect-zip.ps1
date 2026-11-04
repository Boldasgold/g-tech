Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = 'C:/Users/tiujo/.gemini/antigravity/brain/81f1ee1a-b96b-49de-99b5-43ad29321e47/.user_uploaded/media_1793830366515_f8ba299c.zip'
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
foreach ($entry in $zip.Entries) {
    Write-Output "$($entry.FullName) | $($entry.Length) bytes"
}
$zip.Dispose()

