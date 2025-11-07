# PowerShell script to test currency conversion API

Write-Host "Testing Currency Conversion API" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Test 1: Get exchange rate USD to GEO
Write-Host "Test 1: USD to GEO exchange rate" -ForegroundColor Yellow
$query1 = @{
    query = "query { exchangeRate(fromCurrency: `"USD`", toCurrency: `"GEO`") }"
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "http://localhost:3000/graphql" -Method Post -Body $query1 -ContentType "application/json"
Write-Host "Response: $($response1.data.exchangeRate)" -ForegroundColor Cyan
Write-Host ""

# Test 2: Get exchange rate EUR to GEO
Write-Host "Test 2: EUR to GEO exchange rate" -ForegroundColor Yellow
$query2 = @{
    query = "query { exchangeRate(fromCurrency: `"EUR`", toCurrency: `"GEO`") }"
} | ConvertTo-Json

$response2 = Invoke-RestMethod -Uri "http://localhost:3000/graphql" -Method Post -Body $query2 -ContentType "application/json"
Write-Host "Response: $($response2.data.exchangeRate)" -ForegroundColor Cyan
Write-Host ""

# Test 3: Get exchange rate RUB to USD
Write-Host "Test 3: RUB to USD exchange rate" -ForegroundColor Yellow
$query3 = @{
    query = "query { exchangeRate(fromCurrency: `"RUB`", toCurrency: `"USD`") }"
} | ConvertTo-Json

$response3 = Invoke-RestMethod -Uri "http://localhost:3000/graphql" -Method Post -Body $query3 -ContentType "application/json"
Write-Host "Response: $($response3.data.exchangeRate)" -ForegroundColor Cyan
Write-Host ""

# Test 4: Get multiple exchange rates at once
Write-Host "Test 4: Multiple exchange rates" -ForegroundColor Yellow
$query4 = @{
    query = "query { usdToGeo: exchangeRate(fromCurrency: `"USD`", toCurrency: `"GEO`") eurToGeo: exchangeRate(fromCurrency: `"EUR`", toCurrency: `"GEO`") usdToEur: exchangeRate(fromCurrency: `"USD`", toCurrency: `"EUR`") }"
} | ConvertTo-Json

$response4 = Invoke-RestMethod -Uri "http://localhost:3000/graphql" -Method Post -Body $query4 -ContentType "application/json"
Write-Host "USD to GEO: $($response4.data.usdToGeo)" -ForegroundColor Cyan
Write-Host "EUR to GEO: $($response4.data.eurToGeo)" -ForegroundColor Cyan
Write-Host "USD to EUR: $($response4.data.usdToEur)" -ForegroundColor Cyan
Write-Host ""

Write-Host "All tests completed!" -ForegroundColor Green
