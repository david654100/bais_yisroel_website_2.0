document.addEventListener("DOMContentLoaded", function () {
    let updateZmanimFlag = true;

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

        const apiUrl = `https://corsproxy.io/?url=https://us-central1-bais-website.cloudfunctions.net/bais_shul_times?date=${todayDate}`;

        try {
            const response = await fetch(apiUrl);
        
            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
        
            const json = await response.json();

            if (json.status === "success" && json.data.length > 0) {
                const zmanim = json.data[0];

                const zmanimMapping = {
                    hebrewDate: zmanim.hebrew_day,
                    earlyMorningShacharis: convertTo12HourFormat(zmanim.bais_base_first_shachrit_time),
                    morningShacharis: convertTo12HourFormat(zmanim.bais_second_shachrit_time),
                    earlyMincha: dayOfWeek === 0 ? convertTo12HourFormat(zmanim.bais_early_mincha_time) : null,
                    weekdayMinchaMaariv: convertTo12HourFormat(zmanim.bais_reg_mincha_time),
                    candleLighting: convertTo12HourFormat(zmanim.candle_lighting_time),
                    parsha: zmanim.parsha,
                    havdalah: convertTo12HourFormat(zmanim.havdala_time),
                    fastStarts: convertTo12HourFormat(zmanim.zmanim_alos_bais),
                    fastEnds: convertTo12HourFormat(zmanim.fast_ends)
                };
        
                Object.keys(zmanimMapping).forEach(key => {
                    const element = document.getElementById(key);
                    if (element) {
                        element.textContent = zmanimMapping[key] || "N/A";
                    }
                });

                const earlyMinchaRow = document.getElementById("earlyMinchaRow");
                const earlyMinchaSpan = document.getElementById("earlyMincha");
                const fastEndsRow = document.getElementById("fastEndsRow");
                const fastEndsSpan = document.getElementById("fastEnds");
                const fastStartsRow = document.getElementById("fastStartsRow");
                const fastStartsSpan = document.getElementById("FastStarts");

                if (zmanim.bais_early_mincha_time) { 
                    earlyMinchaRow.style.display = "block";
                    earlyMinchaSpan.textContent = convertTo12HourFormat(zmanim.bais_early_mincha_time);
                } else {
                    earlyMinchaRow.style.display = "none"; 
                }

                if (zmanim.fast_ends) { 
                    fastEndsRow.style.display = "block";
                    fastEndsSpan.textContent = convertTo12HourFormat(zmanim.fast_ends);
                } else {
                    fastEndsRow.style.display = "none"; 
                }

                if (zmanim.zmanim_alos_bais) { 
                    fastStartsRow.style.display = "block";
                    fastStartsSpan.textContent = convertTo12HourFormat(zmanim.zmanim_alos_bais);
                } else {
                    fastStartsRow.style.display = "none"; 
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

document.getElementById("byso").addEventListener("click", async () => {
    const spinner = document.getElementById("spinner");
    try {
      spinner.style.display = "block";
  
      const response = await fetch("http://localhost:3001/api/sharepoint/recent-file");
  
      if (!response.ok) {
        throw new Error("File download failed.");
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
  
      const link = document.createElement("a");
      link.href = url;
      link.download = "BYSO_Newsletter.pdf";
      document.body.appendChild(link);
      link.click();
  
      link.remove();
      window.URL.revokeObjectURL(url);
  
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Failed to download the newsletter.");
    } finally {
      spinner.style.display = "none"; 
    }
  });
  
  