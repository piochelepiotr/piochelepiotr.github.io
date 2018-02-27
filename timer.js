var startTime, interval;

function start()
{
    startTime = Date.now();
    interval = setInterval(
        function()
        {
            updateDisplay(Date.now() - startTime);
        }, 1);
}

function updateDisplay(currentTime)
{
    $("h1.timer").html(currentTime);
}

start();
