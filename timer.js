var startTime, interval;

function start()
{
    startTime = Date.now();
    interval = setInterval(
        function()
        {
            updateDisplay(Date.now() - startTime);
        });
}

function updateDisplay(currentTime)
{
    $("h1.timer").html(currentTime);
}

start();
