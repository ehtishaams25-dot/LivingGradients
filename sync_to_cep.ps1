# Sync LivingGradients source to CEP extensions folder
$source = "d:\Ehtishaam\Files\Mine\New Branding\Scripts\Gradients combined script\v2\LivingGradients"
$dest = "$env:APPDATA\Adobe\CEP\extensions\LivingGradients"
Copy-Item -Path "$source\*" -Destination "$dest\" -Recurse -Force -Exclude "sync_to_cep.ps1","node_modules",".git"
Write-Host "Synced to $dest" -ForegroundColor Green