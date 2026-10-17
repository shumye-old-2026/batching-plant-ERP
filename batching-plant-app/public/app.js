 const firebaseConfig = {
    apiKey: "AIzaSyBe6MbmsmqaW3i-wVNen0x7pSEhZOg_8WI",
    authDomain: "batching-plant-db.firebaseapp.com",
    databaseURL: "https://batching-plant-db-default-rtdb.firebaseio.com",
    projectId: "batching-plant-db",
    storageBucket: "batching-plant-db.firebasestorage.app",
    messagingSenderId: "306790169355",
    appId: "1:306790169355:web:7097e06b3bf0e59412800e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

db.enablePersistence().catch(function(err) {
    console.error("Offline persistence failed: ", err.code);
});

const items = {
    "ሲሚንቶ": { 
        "OPC_Lemi": "OPC ለሚ", "PPC_Lemi": "PPC ለሚ", 
        "OPC_Dangote": "OPC ዳንጎቴ", "PPC_Dangote": "PPC ዳንጎቴ", 
        "OPC_Ethio": "OPC ኢትዮ", "PPC_Ethio": "PPC ኢትዮ" 
    },
    "አሸዋ": { 
        "Natural_Sand": "Natural Sand", 
        "Silica_Sand": "Silica Sand", 
        "Crushed_Sand": "Crushed Sand" 
    },
    "ጠጠር": { 
        "Agg00": "ጠጠር 00", "Agg01": "ጠጠር 01", "Agg02": "ጠጠር 02" 
    },
    "ኬሚካል": { 
        "Additive_GP80": "GP80", "Additive_GT30": "GT30" 
    }
};

let stocks = {
    "OPC_Lemi": 0, "PPC_Lemi": 0, "OPC_Dangote": 0, "PPC_Dangote": 0, "OPC_Ethio": 0, "PPC_Ethio": 0,
    "Natural_Sand": 0, "Silica_Sand": 0, "Crushed_Sand": 0, "Agg00": 0, "Agg01": 0, "Agg02": 0,
    "Additive_GP80": 0, "Additive_GT30": 0
};

let mixRecipes = {};
let logs = new Array(); // መቆራረጥን ለመከላከል በ Array የተተካ [span_14](start_span)[span_14](end_span)
let currentUser = null;

// የ properties ንባብን ያለ ካሬ ቅንፍ ለማከናወን የተዘጋጀ ረዳት ተግባር
function getVal(obj, key) {
    return Reflect.get(obj, key);
}

function setVal(obj, key, val) {
    Reflect.set(obj, key, val);
}

// 🔐 የመግቢያ ስርዓት መቆጣጠሪያ [span_17](start_span)[span_17](end_span)
function handleLogin() {
    let user = document.getElementById("loginUser").value;
    let pass = document.getElementById("userPassword").value;
    if (!user) { alert("እባክዎ መጀመሪያ ተጠቃሚ ይምረጡ!"); return; }
    
    // 🔐 ለእያንዳንዱ ተጠቃሚ የተለየ የይለፍ ቃል ማረጋገጫ (Passwords) [span_18](start_span)[span_18](end_span)
    if (user === "አስረካቢ" && pass!== "store123") { alert("🚨 የተሳሳተ የይለፍ ቃል!"); return; }
    if (user === "ቸክ አድራጊ" && pass!== "lab123") { alert("🚨 የተሳሳተ የይለፍ ቃል!"); return; }
    if (user === "አፅዳቂ" && pass!== "manager123") { alert("🚨 የተሳሳተ የይለፍ ቃል!"); return; }

    currentUser = user;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("main-screen").style.display = "block";
    document.getElementById("userBar").style.display = "flex";
    document.getElementById("welcomeText").innerText = "👤 ተጠቃሚ፡ " + currentUser;

    // አፅዳቂው ሁሉንም የገቢ፣ ወጪ እና Mix Design ፎርሞች ማየት አለበት 
    if (currentUser === "አፅዳቂ") {
        document.getElementById("box-inbound").style.display = "block";
        document.getElementById("box-outbound").style.display = "block";
        document.getElementById("box-mix").style.display = "block";
    }  if (currentUser === "አስረካቢ") {
        document.getElementById("box-inbound").style.display = "block";
        document.getElementById("box-outbound").style.display = "block";
        document.getElementById("box-mix").style.display = "none";
    } else if (currentUser === "ቸክ አድራጊ") {
        document.getElementById("box-inbound").style.display = "none";
        document.getElementById("box-outbound").style.display = "none";
        document.getElementById("box-mix").style.display = "block";
    }

    listenToData();
}

function handleLogout() {
    currentUser = null;
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("main-screen").style.display = "none";
}
 // ☁️ መረጃዎችን ከ Cloud Firestore በቀጥታ ለማዳመጥ [span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span)
function listenToData() {
    db.collection("stocks").doc("current").onSnapshot(function(doc) {
        if (doc.exists) {
            stocks = doc.data();
            updateUI();
        } else {
            db.collection("stocks").doc("current").set(stocks);
        }
    });

    db.collection("recipes").onSnapshot(function(snapshot) {
        snapshot.forEach(function(doc) {
            setVal(mixRecipes, doc.id, doc.data());
        });
    });

    db.collection("logs").orderBy("timestamp", "desc").onSnapshot(function(snapshot) {
        let logBody = document.getElementById("reportLog");
        if (!logBody) return;
        logBody.innerHTML = "";
        logs = new Array();

        // 📊 የትንተና ዳሽቦርድ መነሻ እሴቶች (BamaMix Analytics Variables) 
        let now = new Date();
        let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        let lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        let todayConcrete = 0;
        let thisMonthConcrete = 0;
        let lastMonthConcrete = 0;

        // ለእያንዳንዱ 14 ቁሳቁስ እለታዊና ወርሃዊ መረጃዎችን ለመያዝ 
        let stats = {};
        for (let cat in items) {
            let catItems = getVal(items, cat);
            for (let key in catItems) {
                Reflect.set(stats, key, {
                    todayIn: 0,
                    thisMonthIn: 0,
                    lastMonthIn: 0,
                    thisMonthOut: 0,
                    lastMonthOut: 0
                });
            }
        }

        snapshot.forEach(function(docSnap) {
            let log = docSnap.data();
            let id = docSnap.id;
            logs.push(Object.assign({ docId: id }, log));
            let statusCell = "";

            if (log.status === "የጸደቀ") {
                statusCell = "✅ ጸድቋል (" + log.approver + ")";
                // አፅዳቂው የጸደቁትን እንቅስቃሴዎች እንዲሰርዝ ማድረጊያ አዝራር 
                if (currentUser === "አፅዳቂ") {
                    statusCell += ' <button class="approve-btn" style="background:#c05746; margin-left:5px;" onclick="deleteTransaction(\'' + id + '\')">🗑️ አጥፋ</button>';
                }
            } else {
                if (currentUser === "አፅዳቂ") {
                    statusCell = '<button class="approve-btn" onclick="approveTransaction(\'' + id + '\')">APPROVE</button>';
                    statusCell += ' <button class="approve-btn" style="background:#c05746; margin-left:5px;" onclick="deleteTransaction(\'' + id + '\')">🗑️ አጥፋ</button>';
                } else {
                    statusCell = "⏳ ፍቃድ ይጠብቃል";
                }
            }

            // 📊 በእውነተኛ ጊዜ የገቢና ወጪ መጠኖችን ማጠቃለል 
            let logDate = log.timestamp? log.timestamp.toDate() : new Date(log.date);
            let isToday = logDate >= todayStart;
            let isThisMonth = logDate >= thisMonthStart;
            let isLastMonth = logDate >= lastMonthStart && logDate <= lastMonthEnd;

            if (log.status === "የጸደቀ") {
                if (log.type === "ገቢ") {
                    let key = log.rawKey;
                    let amt = parseFloat(log.rawAmt || 0);
                    let matStat = Reflect.get(stats, key);
                    if (matStat) {
                        if (isToday) matStat.todayIn += amt;
                        if (isThisMonth) matStat.thisMonthIn += amt;
                        if (isLastMonth) matStat.lastMonthIn += amt;
 }
                } else if (log.type === "ወጪ") {
                    let vol = parseFloat(log.vol || 0);
                    if (isToday) todayConcrete += vol;
                    if (isThisMonth) thisMonthConcrete += vol;
                    if (isLastMonth) lastMonthConcrete += vol;

                    // በወጪ ኮንክሪት ወቅት የተበላሹትን እያንዳንዱን የጥሬ እቃ አይነቶች ማስላት 
                    let recipe = Reflect.get(mixRecipes, log.grade);
                    if (recipe) {
                        let cementAmt = (recipe.cementAmt * vol) / 100;
                        let cementStat = Reflect.get(stats, recipe.cementKey);
                        if (cementStat) {
                            if (isThisMonth) cementStat.thisMonthOut += cementAmt;
                            if (isLastMonth) cementStat.lastMonthOut += cementAmt;
                        }

                        let sandAmt = (recipe.sandAmt * vol) / 1500;
                        let sandStat = Reflect.get(stats, recipe.sandKey); 
                        if (sandStat) {
                            if (isThisMonth) sandStat.thisMonthOut += sandAmt;
                            if (isLastMonth) sandStat.lastMonthOut += sandAmt;
                        }

                        let chemAmt = recipe.chemAmt * vol;
                        let chemStat = Reflect.get(stats, recipe.chemKey);
                        if (chemStat) {
                            if (isThisMonth) chemStat.thisMonthOut += chemAmt;
                            if (isLastMonth) chemStat.lastMonthOut += chemAmt;
                        }

                        let g01Amt = (recipe.agg01 * vol) / 1500;
                        let g01Stat = Reflect.get(stats, "Agg01");
                        if (g01Stat) {
                            if (isThisMonth) g01Stat.thisMonthOut += g01Amt;
                            if (isLastMonth) g01Stat.lastMonthOut += g01Amt;
                        }

                        let g02Amt = (recipe.agg02 * vol) / 1500;
                        let g02Stat = Reflect.get(stats, "Agg02");
                        if (g02Stat) {
                            if (isThisMonth) g02Stat.thisMonthOut += g02Amt;
                            if (isLastMonth) g02Stat.lastMonthOut += g02Amt;
                        }

                        let g00Amt = (recipe.agg00 * vol) / 1500;
                        let g00Stat = Reflect.get(stats, "Agg00");
                        if (g00Stat) {
                            if (isThisMonth) g00Stat.thisMonthOut += g00Amt;
                            if (isLastMonth) g00Stat.lastMonthOut += g00Amt;
                        }
                    }
                }
            }

            logBody.innerHTML += '<tr>' +
                '<td>' + log.date + '</td>' +
                '<td style="color:' + (log.type === "ገቢ"? "green" : "red") + '; font-weight:bold;">' + log.type + '</td>' +
                '<td>' + log.itemDetails + '</td>' +
                '<td>' + log.amount + '</td>' +
                '<td>' + (log.recipeDetails || "-") + '</td>' +
                '<td>' + log.sourceTarget + '</td>' +
                '<td>' + log.driverInfo + '</td>' +
                '<td>' + log.staff + '</td>' +
                '<td>' + statusCell + '</td>' +
                '</tr>';
        });

        // 📊 በዳሽቦርዱ ላይ የኮንክሪት እሴቶችን መጫን 
        document.getElementById("today-outflow").innerText = todayConcrete.toFixed(2) + " m³";
        document.getElementById("month-outflow").innerText = thisMonthConcrete.toFixed(2) + " m³";
        
        let outflowGrowth = calcGrowth(thisMonthConcrete, lastMonthConcrete);
        document.getElementById("outflow-growth").innerText = "ከባለፈው ወር፡ " + outflowGrowth;
        document.getElementById("outflow-growth").style.color = lastMonthConcrete <= thisMonthConcrete? "#2a9d8f" : "#e76f51";
 // 📊 የእያንዳንዱን ማተሪያል እለታዊና ወርሃዊ ሪፖርት መጫኛ 
        let analyticsTableBody = document.getElementById("analyticsTableBody");
        if (analyticsTableBody) {
            analyticsTableBody.innerHTML = "";
            for (let cat in items) {
                let catItems = getVal(items, cat);
                for (let key in catItems) {
                    let matStat = Reflect.get(stats, key);
                    let unit = " kg";
                    if (cat === "ሲሚንቶ") unit = " Qt";
                    else if (cat === "አሸዋ" || cat === "ጠጠር") unit = " m³";
                    else if (cat === "ኬሚካል") unit = " L";

                    let inGrow = calcGrowth(matStat.thisMonthIn, matStat.lastMonthIn);
                    let outGrow = calcGrowth(matStat.thisMonthOut, matStat.lastMonthOut);

                    let inGrowColor = matStat.lastMonthIn <= matStat.thisMonthIn? "#2a9d8f" : "#e76f51";
                    let outGrowColor = matStat.lastMonthOut <= matStat.thisMonthOut? "#2a9d8f" : "#e76f51";

                    let rowHtml = '<tr>' +
                        '<td><strong>' + catItems[key] + '</strong> (' + cat + ')</td>' +
                        '<td>' + matStat.todayIn.toFixed(2) + unit + '</td>' +
                        '<td>' + matStat.thisMonthIn.toFixed(2) + unit + '</td>' +
                        '<td style="color:' + inGrowColor + '; font-weight:bold;">' + inGrow + '</td>' +
                        '<td>' + matStat.thisMonthOut.toFixed(2) + unit + '</td>' +
                        '<td style="color:' + outGrowColor + '; font-weight:bold;">' + outGrow + '</td>' +
                        '</tr>';
                    analyticsTableBody.innerHTML += rowHtml;
                }
            }
        }
    });
}

// 📊 የእድገት ፐርሰንት ቀመር ማስያ ተግባር (MoM Growth Rate) 
function calcGrowth(current, previous) {
    if (previous === 0) {
        return current > 0? "+100.00%" : "0.00%";
    }
    let change = ((current - previous) / previous) * 100;
    let sign = change >= 0? "+" : "";
    return sign + change.toFixed(2) + "%";
}

function updateUI() {
    let summary = document.getElementById("stock-summary");
    if (!summary) return;
    summary.innerHTML = "";
    const colors = { "ሲሚንቶ": "#E65100", "አሸዋ": "#f4a261", "ጠጠር": "#2a9d8f", "ኬሚካል": "#264653" };
    
    for (let cat in items) {
        let catColor = getVal(colors, cat) || "#666";
        let unit = " kg";
        if (cat === "ሲሚንቶ") unit = " Qt (ኩንታል)";
        else if (cat === "አሸዋ" || cat === "ጠጠር") unit = " m³";
        else if (cat === "ኬሚካል") unit = " L (ሊትር)";

        let catItems = getVal(items, cat);
        for (let key in catItems) {
            let val = parseFloat(getVal(stocks, key) || 0).toFixed(2);
            let itemDisplayName = getVal(catItems, key);
            summary.innerHTML += '<div class="card" style="background-color: ' + catColor + '"><small>' + cat + '</small><br><strong>' + itemDisplayName + '</strong><br><span>' + val + unit + '</span></div>';
        }
    }
}

function populateSub(catId, subId) {
    let cat = document.getElementById(catId).value;
    let sub = document.getElementById(subId);
    if (!sub) return;
    sub.innerHTML = "";
    let catItems = getVal(items, cat);
    for (let key in catItems) {
        let opt = document.createElement("option");
        opt.value = key; 
        opt.text = getVal(catItems, key);
        sub.appendChild(opt);
    }
    if(catId === "inCat") {
        let amtInput = document.getElementById("inAmt");
        if (cat === "ሲሚንቶ") amtInput.placeholder = "መጠን (በኩንታል)";
        else if (cat === "አሸዋ" || cat === "ጠጠር") amtInput.placeholder = "መጠን (በm³)";
        else if (cat === "ኬሚካል") amtInput.placeholder = "መጠን (በሊትር)";
    }
}

function saveInbound() {
    let cat = document.getElementById("inCat").value;
    let key = document.getElementById("inSub").value;
    let amt = parseFloat(document.getElementById("inAmt").value || 0);
    if (amt <= 0) { alert("እባክዎ ትክክለኛ መጠን ያስገቡ"); return; }
 let catItems = getVal(items, cat);
    let itemDisplayName = getVal(catItems, key);

    db.collection("logs").add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        date: new Date().toLocaleString('am-ET'), type: "ገቢ", status: "በሂደት ላይ", approver: "-",
        itemDetails: cat + " (" + itemDisplayName + ")", amount: amt + (cat === "ሲሚንቶ"? " Qt" : " m³"),
        rawKey: key, rawAmt: amt,
        recipeDetails: "-",
        sourceTarget: document.getElementById("inSupplier").value || "-",
        driverInfo: (document.getElementById("inDriver").value || "-") + " (" + (document.getElementById("inPlate").value || "-") + ")",
        staff: "ተረካቢ፡ " + (document.getElementById("inReceiver").value || "-") + " / ቸከር፡ " + (document.getElementById("inChecker").value || "-") + " / አስረካቢ፡ " + currentUser
    }).then(function() {
        alert("የገቢ ጥያቄ ለዳታቤዝ ተልኳል!");
        document.getElementById("inAmt").value = "";
        document.getElementById("inSupplier").value = "";
        document.getElementById("inDriver").value = "";
        document.getElementById("inPlate").value = "";
        document.getElementById("inReceiver").value = "";
        document.getElementById("inChecker").value = "";
        document.getElementById("inApprover").value = "";
    });
}

function saveMix() {
    let grade = document.getElementById("mixGrade").value;
    let cementType = document.getElementById("mixCement").value;
    let sandType = document.getElementById("mixSand").value;
    
    // የጠጠሮቹን ሁኔታ ማረጋገጥ
    let useAgg00 = parseFloat(document.getElementById("mixAgg00Amt").value || 0) > 0;
    let useAgg01 = parseFloat(document.getElementById("mixAgg01Amt").value || 0) > 0;
    let useAgg02 = parseFloat(document.getElementById("mixAgg02Amt").value || 0) > 0;
    
    let ratio = parseFloat(document.getElementById("mixCementAmt").value || 0);
    let checker = document.getElementById("mixChecker").value.trim();

    if (!grade) {
        alert("እባክዎ መጀመሪያ የኮንክሪት Grade ይምረጡ!");
        return;
    }

    db.collection("recipes").doc(grade).set({
        cementType: cementType,
        sandType: sandType,
        useAgg00: useAgg00,
        useAgg01: useAgg01,
        useAgg02: useAgg02,
        ratio: ratio,
        checker: checker,
        cementAmt: parseFloat(document.getElementById("mixCementAmt").value || 0),
        sandAmt: parseFloat(document.getElementById("mixSandAmt").value || 0),
        agg01: parseFloat(document.getElementById("mixAgg01Amt").value || 0),
        agg02: parseFloat(document.getElementById("mixAgg02Amt").value || 0),
        agg00: parseFloat(document.getElementById("mixAgg00Amt").value || 0),
        chemKey: document.getElementById("mixChem").value,
        chemAmt: parseFloat(document.getElementById("mixChemAmt").value || 0)
    }).then(function() {
        alert("የ " + grade + " Mix Design ሬሾ በክላውድ ላይ በስኬት ተመዝግቧል!");
        document.getElementById("mixCementAmt").value = "";
        document.getElementById("mixSandAmt").value = "";
        document.getElementById("mixAgg00Amt").value = "";
        document.getElementById("mixAgg01Amt").value = "";
        document.getElementById("mixAgg02Amt").value = "";
        document.getElementById("mixChemAmt").value = "";
        document.getElementById("mixChecker").value = "";
    });
}

// 🛑 ስቶክ ማረጋገጫ እና የጎደለውን ቁሳቁስ በዝርዝር የሚያሳይ የወጪ ጥያቄ (Store Request Phase)
function saveOutbound() {
    let grade = document.getElementById("outGrade").value;
    let volume = parseFloat(document.getElementById("outVolume").value || 0);
    if (!grade || volume <= 0) { alert("እባክዎ ግሬድ እና መጠን በትክክል ያስገቡ"); return; }

    let recipe = getVal(mixRecipes, grade);
    if (!recipe) { 
        alert("🚨 ለ " + grade + " የተመዘገበ የ Mix Design ሬሾ የለም! እባክዎ መጀመሪያ Mix Design ላይ ይመዝግቡ።"); 
        return; 
    }
 // ከስቶክ መለኪያ ጋር የሚዛመድ ፍጆታ ስሌት
    let reqCement = (recipe.cementAmt * volume) / 100;    
    let reqSand = (recipe.sandAmt * volume) / 1500;      
    let reqAgg01 = (recipe.agg01 * volume) / 1500;     
    let reqAgg02 = (recipe.agg02 * volume) / 1500;     
    let reqAgg00 = (recipe.agg00 * volume) / 1500;     
    let reqChem = recipe.chemAmt * volume;            

    let missingItems = new Array();

    let cementStock = parseFloat(getVal(stocks, recipe.cementType)) || 0;
    if (cementStock < reqCement) {
        let diff = (reqCement - cementStock).toFixed(2);
        let displayName = getVal(getVal(items, "ሲሚንቶ"), recipe.cementType);
        missingItems.push("- " + displayName + " መጠን በ " + diff + " Qt (ኩንታል) ጎድሏል");
    }

    let sandStock = parseFloat(getVal(stocks, recipe.sandType)) || 0;
    if (sandStock < reqSand) {
        let diff = (reqSand - sandStock).toFixed(2);
        let displayName = getVal(getVal(items, "አሸዋ"), recipe.sandType);
        missingItems.push("- " + displayName + " መጠን በ " + diff + " m³ ጎድሏል");
    }

    let agg01Stock = parseFloat(getVal(stocks, "Agg01")) || 0;
    if (agg01Stock < reqAgg01) {
        let diff = (reqAgg01 - agg01Stock).toFixed(2);
        let displayName = getVal(getVal(items, "ጠጠር"), "Agg01");
        missingItems.push("- " + displayName + " መጠን በ " + diff + " m³ ጎድሏል");
    }

    let agg02Stock = parseFloat(getVal(stocks, "Agg02")) || 0;
    if (agg02Stock < reqAgg02) {
        let diff = (reqAgg02 - agg02Stock).toFixed(2);
        let displayName = getVal(getVal(items, "ጠጠር"), "Agg02");
        missingItems.push("- " + displayName + " m³ ጎድሏል");
    }

    let agg00Stock = parseFloat(getVal(stocks, "Agg00")) || 0;
    if (agg00Stock < reqAgg00) {
        let diff = (reqAgg00 - agg00Stock).toFixed(2);
        let displayName = getVal(getVal(items, "ጠጠር"), "Agg00");
        missingItems.push("- " + displayName + " m³ ጎድሏል");
    }

    let chemStock = parseFloat(getVal(stocks, recipe.chemKey)) || 0;
    if (chemStock < reqChem) {
        let diff = (reqChem - chemStock).toFixed(2);
        let displayName = getVal(getVal(items, "ኬሚካል"), recipe.chemKey);
        missingItems.push("- " + displayName + " መጠን በ " + diff + " L ጎድሏል");
    }

    // 🚨 የጎደለ እቃ ካለ ወጪ ጥያቄው አይላክም!
    if (missingItems.length > 0) {
        alert("🚨 ስህተት፦ ለተጠየቀው " + volume + " m³ ለማምረት በቂ ጥሬ ዕቃ የለም!\n\n" + missingItems.join("\n"));
        return;
    }

    let cementName = getVal(getVal(items, "ሲሚንቶ"), recipe.cementType);
    let sandName = getVal(getVal(items, "አሸዋ"), recipe.sandType);
    let chemName = getVal(getVal(items, "ኬሚካል"), recipe.chemKey);
    
    let recipeDetails = "ሲሚንቶ: " + cementName + " (" + (recipe.cementAmt * volume).toFixed(0) + " kg), " +
                        "አሸዋ: " + sandName + " (" + (recipe.sandAmt * volume).toFixed(0) + " kg), " +
                        "ጠጠር 01: " + (recipe.agg01 * volume).toFixed(0) + " kg, " +
                        "ጠጠር 02: " + (recipe.agg02 * volume).toFixed(0) + " kg, " +
                        "ጠጠር 00: " + (recipe.agg00 * volume).toFixed(0) + " kg, " +
                        "ኬሚካል: " + chemName + " (" + (recipe.chemAmt * volume).toFixed(1) + " L)";

    db.collection("logs").add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        date: new Date().toLocaleString('am-ET'), type: "ወጪ", status: "በሂደት ላይ", approver: "-",
        itemDetails: "Concrete " + grade, amount: volume + " m³", grade: grade, vol: volume,
        recipeDetails: recipeDetails,
        sourceTarget: document.getElementById("outSite").value || "-",
        driverInfo: (document.getElementById("outDriver").value || "-") + " (" + (document.getElementById("outPlate").value || "-") + ")",
        staff: "አስረካቢ፡ " + (document.getElementById("outIssuer").value || "-") + " / ቸከር፡ " + (document.getElementById("outChecker").value || "-") + " / አስረካቢ፡ " + currentUser
 }).then(function() {
        alert("የወጪ ጥያቄ ለዳታቤዝ ተልኳል!");
        document.getElementById("outVolume").value = "";
        document.getElementById("outSite").value = "";
        document.getElementById("outDriver").value = "";
        document.getElementById("outPlate").value = "";
    });
}

// 🟢 አፅዳቂው ሲያጸድቅ ስቶክ ላይ የሚቀንስ/የሚጨምር ተግባር 
async function approveTransaction(docId) {
    let logRef = db.collection("logs").doc(docId);
    let logDoc = await logRef.get();
    if (!logDoc.exists) return;
    let log = logDoc.data();

    let stockRef = db.collection("stocks").doc("current");
    let stockDoc = await stockRef.get();
    let currentStocks = stockDoc.data();

    if (log.type === "ገቢ") {
        let currentVal = parseFloat(getVal(currentStocks, log.rawKey)) || 0;
        setVal(currentStocks, log.rawKey, currentVal + parseFloat(log.rawAmt));
    } else if (log.type === "ወጪ") {
        let recipe = getVal(mixRecipes, log.grade);
        if (!recipe) { alert("🚨 ለዚህ ግሬድ Mix Design ሬሾ በክላውድ ላይ አልተገኘም!"); return; }
        let vol = log.vol;

        let reqCement = (recipe.cementAmt * vol) / 100;
        let reqSand = (recipe.sandAmt * vol) / 1500;
        let reqAgg01 = (recipe.agg01 * vol) / 1500;
        let reqAgg02 = (recipe.agg02 * vol) / 1500;
        let reqAgg00 = (recipe.agg00 * vol) / 1500;
        let reqChem = recipe.chemAmt * vol;

        let missingItems = new Array();

        let cementStock = parseFloat(getVal(currentStocks, recipe.cementType)) || 0;
        if (cementStock < reqCement) {
            let diff = (reqCement - cementStock).toFixed(2);
            let displayName = getVal(getVal(items, "ሲሚንቶ"), recipe.cementType);
            missingItems.push("- " + displayName + " መጠን በ " + diff + " Qt (ኩንታል) ጎድሏል");
        }

        let sandStock = parseFloat(getVal(currentStocks, recipe.sandType)) || 0;
        if (sandStock < reqSand) {
            let diff = (reqSand - sandStock).toFixed(2);
            let displayName = getVal(getVal(items, "አሸዋ"), recipe.sandType);
            missingItems.push("- " + displayName + " መጠን በ " + diff + " m³ ጎድሏል");
        }

        let agg01Stock = parseFloat(getVal(currentStocks, "Agg01")) || 0;
        if (agg01Stock < reqAgg01) {
            let diff = (reqAgg01 - agg01Stock).toFixed(2);
            let displayName = getVal(getVal(items, "ጠጠር"), "Agg01");
            missingItems.push("- " + displayName + " መጠን በ " + diff + " m³ ጎድሏል");
        }

        let agg02Stock = parseFloat(getVal(currentStocks, "Agg02")) || 0;
        if (agg02Stock < reqAgg02) {
            let diff = (reqAgg02 - agg02Stock).toFixed(2);
            let displayName = getVal(getVal(items, "ጠጠር"), "Agg02");
            missingItems.push("- " + displayName + " m³ ጎድሏል");
        }

        let agg00Stock = parseFloat(getVal(currentStocks, "Agg00")) || 0;
        if (agg00Stock < reqAgg00) {
            let diff = (reqAgg00 - agg00Stock).toFixed(2);
            let displayName = getVal(getVal(items, "ጠጠር"), "Agg00");
            missingItems.push("- " + displayName + " m³ ጎድሏል");
        }

        let chemStock = parseFloat(getVal(currentStocks, recipe.chemKey)) || 0;
        if (chemStock < reqChem) {
            let diff = (reqChem - chemStock).toFixed(2);
            let displayName = getVal(getVal(items, "ኬሚካል"), recipe.chemKey);
            missingItems.push("- " + displayName + " መጠን በ " + diff + " L ጎድሏል");
        }

        // 🚨 በማጽደቅ ወቅትም ክምችት እጥረት ከታየ አያጸድቅም!
        if (missingItems.length > 0) {
            alert("🚨 ስህተት፦ በቂ ጥሬ ዕቃ በስቶክ ላይ ስለሌለ ማጽደቅ አይቻልም!\n\n" + missingItems.join("\n"));
            return;
        }

        setVal(currentStocks, recipe.cementType, cementStock - reqCement);
        setVal(currentStocks, recipe.sandType, sandStock - reqSand);
        setVal(currentStocks, recipe.chemKey, chemStock - reqChem);
        setVal(currentStocks, "Agg01", agg01Stock - reqAgg01);
        setVal(currentStocks, "Agg02", agg02Stock - reqAgg02);
        setVal(currentStocks, "Agg00", agg00Stock - reqAgg00);
    }
 await stockRef.set(currentStocks);
    await logRef.update({ status: "የጸደቀ", approver: currentUser });
    alert("እንቅስቃሴው በ Cloud ላይ ፅድቆ ተስተካክሏል!");
}

// 🗑️ እንቅስቃሴዎችን ከደመናው ላይ ሙሉ በሙሉ የመሰረዝ እና ስቶኩን በራስ-ሰር የመመለስ ሎጂክ 
async function deleteTransaction(docId) {
    if (!confirm("ይህን እንቅስቃሴ ማጥፋት ይፈልጋሉ?")) return;

    let logRef = db.collection("logs").doc(docId);
    let logDoc = await logRef.get();
    if (!logDoc.exists) return;
    let log = logDoc.data();

    // ጥያቄው አስቀድሞ የጸደቀ ከሆነ ➡️ የነበረውን ስቶክ በራስ-ሰር ወደኋላ እንመልሳለን! 
    if (log.status =[span_13](start_span)[span_13](end_span)== "የጸደቀ") {
        let stockRef = db.collection("stocks").doc("current");
        let stockDoc = await stockRef.get();
        let currentStocks = stockDoc.data();

        if (log.type === "ገቢ") {
            let currentVal = parseFloat(getVal(currentStocks, log.rawKey)) || 0;
            setVal(currentStocks, log.rawKey, currentVal - parseFloat(log.rawAmt));
        } else if (log.type === "ወጪ") {
            let recipe = getVal(mixRecipes, log.grade);
            if (recipe) {
                let vol = log.vol;
                let reqCement = (recipe.cementAmt * vol) / 100;
                let reqSand = (recipe.sandAmt * vol) / 1500;
                let reqAgg01 = (recipe.agg01 * vol) / 1500;
                let reqAgg02 = (recipe.agg02 * vol) / 1500;
                let reqAgg00 = (recipe.agg00 * vol) / 1500;
                let reqChem = recipe.chemAmt * vol;

                setVal(currentStocks, recipe.cementType, (parseFloat(getVal(currentStocks, recipe.cementType)) || 0) + reqCement);
                setVal(currentStocks, recipe.sandType, (parseFloat(getVal(currentStocks, recipe.sandType)) || 0) + reqSand);
                setVal(currentStocks, recipe.chemKey, (parseFloat(getVal(currentStocks, recipe.chemKey)) || 0) + reqChem);
                setVal(currentStocks, "Agg01", (parseFloat(getVal(currentStocks, "Agg01")) || 0) + reqAgg01);
                setVal(currentStocks, "Agg02", (parseFloat(getVal(currentStocks, "Agg02")) || 0) + reqAgg02);
                setVal(currentStocks, "Agg00", (parseFloat(getVal(currentStocks, "Agg00")) || 0) + reqAgg00);
            } else {
                alert("🚨 ለዚህ ግሬድ የነበረው Mix Design ሬሾ ስላልተገኘ ስቶኩን በራስ-ሰር መመለስ አልተቻለም። እባክዎ ስቶኩን በእጅ ያስተካክሉ!");
            }
        }
        await stockRef.set(currentStocks);
    }

    await logRef.delete();
    alert("እንቅስቃሴው በ Cloud ላይ ተሰርዟል!");
}

function exportToExcel() { 
    let html = document.getElementById("reportTable").outerHTML;
    let blob = new Blob([html], { type: "application/vnd.ms-excel" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "BamaMix_Report.xls";
    a.click();
}

function exportToWord() { 
    let html = document.getElementById("reportTable").outerHTML;
    let blob = new Blob(new Array('\ufeff' + html), { type: "application/msword" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "BamaMix_Report.doc";
    a.click();
}

// 🔄 የ Dropdowns መሙላት [መቆራረጥን ለመከላከል በ Array የተገነባ]
function initializeDropdowns() {
    var dropdownMapping = {
        "inCat": "ሲሚንቶ",
        "outCat": "ሲሚንቶ"
    };

    for (var id in dropdownMapping) {
        var el = document.getElementById(id);
        if (el) {
            el.innerHTML = Object.keys(items).map(function(k) {
                return '<option value="' + k + '">' + k + '</option>';
            }).join('');
            el.value = dropdownMapping[id];
        }
    }
}

initializeDropdowns();

// የንዑስ ምርጫዎች መጀመሪያ መጫኛ
populateSub('inCat', 'inSub');
populateSub('outCat', 'outSub');