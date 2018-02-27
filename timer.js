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
    $("p.timer").html(currentTime);
}

start();
