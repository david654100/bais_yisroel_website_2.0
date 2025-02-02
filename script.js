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
    } else {
        console.error("Element #weekRange not found.");
    }
}

async function fetchZmanim() {
    const today = new Date().toISOString().split('T')[0];
    const apiUrl = `https://us-central1-bais-website.cloudfunctions.net/bais_shul_times?date=${today}`;

    try {
        const response = await fetch(apiUrl);
        const json = await response.json();

        if (json.status === "success" && json.data.length > 0) {
            const zmanim = json.data[0];

            console.log("Zmanim Data:", zmanim);

            updateElement("sundayEarlyMincha", zmanim.bais_early_mincha_time);
            updateElement("weekdayMinchaMaariv", zmanim.bais_reg_mincha_time);
            updateElement("shabbosParsha", zmanim.parsha);
            updateElement("erevShabbosDate", zmanim.hebrew_day);
            updateElement("earlyMinchaCandle", zmanim.candle_lighting_time);
            updateElement("regularMinchaCandle", zmanim.bais_reg_mincha_time);
        } else {
            console.error("No data available for the requested date.");
        }
    } catch (error) {
        console.error("Error fetching zmanim data:", error);
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || "N/A";
    } else {
        console.error(`Element #${id} not found.`);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    setWeekRange();
    fetchZmanim();
});

// function makeCollapsible(className) {
//     var coll = document.getElementsByClassName(className);

//     for (var i = 0; i < coll.length; i++) {
//         coll[i].addEventListener("click", function() {
//             this.classList.toggle("active");

//             var content = this.nextElementSibling;

//             if (content.style.display === "block") {
//                 content.style.display = "none";
//             } else {
//                 content.style.display = "block";
//             }
//         });
//     }
// }

                            