document.addEventListener("DOMContentLoaded", function () {
    let updateZmanimFlag = true;

    // Google Calendar API Setup
    // const calendarId = '108b7ae5c30c68449372821128d0147dba38392b443b12276919b9eca40b4292%40group.calendar.google.com&ctz=America%2FChicago'; // Use your calendar ID
    // const apiKey = 'YOUR_GOOGLE_API_KEY'; // Your API Key here
    // const clientId = 'YOUR_GOOGLE_CLIENT_ID'; // Your Client ID here

    // week range (Sunday to Shabbos)
    function getWeekRange() {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const sunday = new Date(today);
        sunday.setDate(today.getDate() - dayOfWeek);
        const saturday = new Date(today);
        saturday.setDate(today.getDate() + (6 - dayOfWeek));

        const options = { month: 'long', day: 'numeric' };
        return `Sunday, ${sunday.toLocaleDateString('en-US', options)} - Shabbos, ${saturday.toLocaleDateString('en-US', options)}`;
    }
    function setWeekRange() {
        const weekRangeElement = document.getElementById("weekRange");
        if (weekRangeElement) {
            weekRangeElement.textContent = getWeekRange();
        }
    }

    // todays date
    function getTodayDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return today.toLocaleDateString('en-US', options);
    }
    function setTodayDate() {
        const todayDateElement = document.getElementById("getTodayDate");
        if (todayDateElement) {
            todayDateElement.textContent = getTodayDate();
        }
    }

    // Convert 24-hour time to 12-hour format
    function convertTo12HourFormat(timeStr) {
        if (!timeStr || timeStr.toLowerCase() === "n/a") return "N/A";

        const [hours, minutes] = timeStr.split(':').map(Number);
        const ampm = hours >= 12 ? "PM" : "AM";
        const convertedHours = hours % 12 || 12;

        return `${convertedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    async function fetchScheduleItems() {
        if (!updateZmanimFlag) return;

        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay();

        const daysToFriday = (5 - dayOfWeek + 7) % 7;
        const fridayDate = new Date(today);
        fridayDate.setDate(today.getDate() + daysToFriday);
        const fridayDateString = fridayDate.toISOString().split('T')[0];  

        const daysToSaturday = (6 - dayOfWeek + 7) % 7; 
        const saturdayDate = new Date(today);
        saturdayDate.setDate(today.getDate() + daysToSaturday);
        const saturdayDateString = saturdayDate.toISOString().split('T')[0];

        const apiUrl = `https://cors-anywhere.herokuapp.com/https://us-central1-bais-website.cloudfunctions.net/bais_shul_times?date=${todayDate}`;
        const friApiUrl = `https://cors-anywhere.herokuapp.com/https://us-central1-bais-website.cloudfunctions.net/bais_shul_times?date=${fridayDateString}`;
        const satApiUrl = `https://cors-anywhere.herokuapp.com/https://us-central1-bais-website.cloudfunctions.net/bais_shul_times?date=${saturdayDateString}`;


        try {
            const response = await fetch(apiUrl);        // Fetch data for today
            const friResponse = await fetch(friApiUrl);  // Fetch Friday's data
            const satResponse = await fetch(satApiUrl);  // Fetch Saturday/Shabbos Data
        
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
            if (!friResponse.ok) throw new Error(`HTTP Error! Status: ${friResponse.status}`);
            if (!satResponse.ok) throw new Error(`HTTP Error! Status: ${satResponse.status}`);
        
            const json = await response.json();
            const friJson = await friResponse.json();
            const satJson = await satResponse.json();
                            
            if (json.status === "success" && json.data.length > 0) {
                const zmanim = json.data[0];
        
                const fridayCandleLightingTime = friJson.data[0]?.candle_lighting_time; // only use Friday's time
                const shabParsha = satJson.data[0]?.parsha
                const havdalahTime = satJson.data[0]?.havdala_time;

                const zmanimMapping = {
                    hebrewDate: zmanim.hebrew_day,
                    earlyMorningShacharis: convertTo12HourFormat(zmanim.bais_base_first_shachrit_time),
                    morningShacharis: convertTo12HourFormat(zmanim.bais_second_shachrit_time),
                    earlyMincha: dayOfWeek === 0 ? convertTo12HourFormat(zmanim.bais_early_mincha_time) : null,
                    weekdayMinchaMaariv: convertTo12HourFormat(zmanim.bais_reg_mincha_time),
                    candleLighting: convertTo12HourFormat(fridayCandleLightingTime),
                    parsha: shabParsha,
                    havdalah: convertTo12HourFormat(havdalahTime),
                };
        
                Object.keys(zmanimMapping).forEach(key => {
                    const element = document.getElementById(key);
                    if (element) {
                        element.textContent = zmanimMapping[key] || "N/A";
                    }
                });

                // const earlyMinchaRow = document.getElementById("earlyMinchaRow");
                // if (earlyMinchaRow) {
                //     earlyMinchaRow.style.display = zmanim.bais_early_mincha_time ? "block" : "none";
                // }

                const earlyMinchaRow = document.getElementById("earlyMinchaRow");
                const earlyMinchaSpan = document.getElementById("earlyMincha");

                if (zmanim.bais_early_mincha_time) { 
                    earlyMinchaRow.style.display = "block";
                    earlyMinchaSpan.textContent = convertTo12HourFormat(zmanim.bais_early_mincha_time);
                } else {
                    earlyMinchaRow.style.display = "none"; 
                }
            
            } else {
                console.error("No valid zmanim data received.");
            }
        } catch (error) {
            console.error("Error fetching zmanim data:", error);
        }
        
    }
    

    setTodayDate();
    setWeekRange();
    fetchScheduleItems();
});
