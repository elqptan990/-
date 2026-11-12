const $ = id => document.getElementById(id);
const STORAGE_KEY = "mojah_quotes_v1";
const PRODUCTS_STORAGE_KEY = "mojah_products_v1";
const CUSTOMERS_STORAGE_KEY = "mojah_customers_v1";
const UNITS_STORAGE_KEY = "mojah_units_v1";
const DEFAULT_TERMS = "والاستلام علي ارض المصنع\nالأسعار سارية الي نهاية الشهر الحالي فقط";
const UNITS = ["Roll", "Drum", "Pail", "Kg"];
const DEFAULT_PRODUCTS = [
  "MAFCO 160-Granule", "115/15", "MC-1 200 Liter","MC-1 160 Liter", "MAFCO 180-Granule", "Polymer",
  "RC-2", "MAFCO 200-Granule", "Second quality", "MAFCO FIBER", "MAFCO 160",
  "MAFCO PROOF", "MAFCO 180", "MAFCO 200", "PRIMER D-41", "Emulsion"
];
let items = [];
let activeQuoteId = "";

function newQuoteId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function money(value) {
  return (Number(value)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function safeText(value) { return String(value ?? "").trim(); }
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function status(message, error=false) {
  $("status").textContent = message;
  $("status").style.color = error ? "#a62d27" : "#147044";
}
function newItem(data={}) {
  return {name:data.name||"", unit:data.unit||"Roll", qty:data.qty ?? 1, price:data.price ?? 0};
}
function readProducts() {
  try {
    const saved = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if(saved === null) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY,JSON.stringify(DEFAULT_PRODUCTS));
      return [...DEFAULT_PRODUCTS];
    }
    const products = JSON.parse(saved);
    if(!Array.isArray(products) || products.some(product => typeof product !== "string")) {
      throw new Error("invalid product catalog");
    }
    return products;
  } catch(e) {
    status("تعذر قراءة قائمة المنتجات المحفوظة.",true);
    return [];
  }
}
function writeProducts(products) {
  try {
    localStorage.setItem(PRODUCTS_STORAGE_KEY,JSON.stringify(products));
    return true;
  } catch(e) {
    status("تعذر حفظ قائمة المنتجات في المتصفح.",true);
    return false;
  }
}
function refreshProductCatalog() {
  const catalog = $("productCatalog");
  catalog.replaceChildren();
  readProducts().forEach(product => {
    const option = document.createElement("option");
    option.value = product;
    catalog.appendChild(option);
  });
}
function readUnits() {
  try {
    const saved = localStorage.getItem(UNITS_STORAGE_KEY);
    if(saved === null) return [...UNITS];
    const units = JSON.parse(saved);
    if(!Array.isArray(units) || units.some(unit => typeof unit !== "string")) {
      throw new Error("invalid unit catalog");
    }
    return [...new Map([...UNITS,...units].map(unit => [safeText(unit).toLocaleLowerCase(),safeText(unit)])).values()]
      .filter(Boolean);
  } catch(e) {
    status("تعذر قراءة قائمة الوحدات المحفوظة.",true);
    return null;
  }
}
function writeUnits(units) {
  try {
    localStorage.setItem(UNITS_STORAGE_KEY,JSON.stringify(units));
    return true;
  } catch(e) {
    status("تعذر حفظ قائمة الوحدات في المتصفح.",true);
    return false;
  }
}
function refreshUnitCatalog() {
  const catalog = $("unitCatalog");
  const units = readUnits();
  if(!units) return;
  catalog.replaceChildren();
  units.forEach(unit => {
    const option = document.createElement("option");
    option.value = unit;
    catalog.appendChild(option);
  });
}
function saveUnit(name) {
  const unit = safeText(name);
  if(!unit) return false;
  const units = readUnits();
  if(!units) return false;
  if(units.some(saved => saved.toLocaleLowerCase() === unit.toLocaleLowerCase())) return true;
  if(!writeUnits([...units,unit])) return false;
  refreshUnitCatalog();
  status("تم حفظ الوحدة في قائمة الوحدات على هذا الجهاز.");
  return true;
}
function readCustomers() {
  try {
    const saved = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if(saved === null) return [];
    const customers = JSON.parse(saved);
    if(!Array.isArray(customers) || customers.some(customer => typeof customer !== "string")) {
      throw new Error("invalid customer catalog");
    }
    return customers;
  } catch(e) {
    status("تعذر قراءة أسماء العملاء المحفوظة؛ لم يتم استبدال أي بيانات.",true);
    return null;
  }
}
function writeCustomers(customers) {
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY,JSON.stringify(customers));
    return true;
  } catch(e) {
    status("تعذر حفظ اسم العميل في المتصفح.",true);
    return false;
  }
}
function refreshCustomerCatalog() {
  const catalog = $("customerCatalog");
  const customers = readCustomers();
  const quotes = readQuotes();
  if(!customers || !quotes) return;
  const names = [...customers,...quotes.map(quote => quote.customer || "")];
  const uniqueNames = [...new Map(names.filter(name => safeText(name)).map(name => [safeText(name).toLocaleLowerCase(),safeText(name)])).values()];
  catalog.replaceChildren();
  uniqueNames.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    catalog.appendChild(option);
  });
}
function rememberCustomer(name) {
  const customer = safeText(name);
  if(!customer) return;
  const customers = readCustomers();
  if(!customers) return;
  if(customers.some(saved => saved.toLocaleLowerCase() === customer.toLocaleLowerCase())) return;
  if(writeCustomers([...customers,customer])) refreshCustomerCatalog();
}
function refreshProductManager() {
  const list = $("productManagementList");
  list.replaceChildren();
  readProducts().forEach((product,index) => {
    const row = document.createElement("div");
    row.className = "product-management-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = product;
    input.setAttribute("aria-label",`اسم المنتج ${index+1}`);
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn small light";
    saveButton.textContent = "حفظ التعديل";
    saveButton.addEventListener("click",() => renameProduct(index,input.value));
    row.append(input,saveButton);
    list.appendChild(row);
  });
}
function saveProduct(name) {
  const product = safeText(name);
  if(!product) return false;
  const products = readProducts();
  if(products.some(saved => saved.toLocaleLowerCase() === product.toLocaleLowerCase())) return true;
  products.push(product);
  if(!writeProducts(products)) return false;
  refreshProductCatalog();
  status("تم حفظ المنتج في قائمة المنتجات على هذا الجهاز.");
  return true;
}
function renameProduct(index,name) {
  const product = safeText(name);
  if(!product) return status("اسم المنتج لا يمكن أن يكون فارغًا.",true);
  const products = readProducts();
  if(products.some((saved,i) => i !== index && saved.toLocaleLowerCase() === product.toLocaleLowerCase())) {
    return status("اسم المنتج موجود بالفعل في القائمة.",true);
  }
  products[index] = product;
  if(!writeProducts(products)) return;
  refreshProductCatalog();
  refreshProductManager();
  status("تم تعديل اسم المنتج وحفظه.");
}
function renderInputs() {
  const body = $("itemsBody");
  body.innerHTML = "";
  items.forEach((item,index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="اسم المادة / الوصف"><input class="item-name" list="productCatalog" data-index="${index}" data-key="name" value="${esc(item.name)}" placeholder="اختر أو اكتب اسم المنتج" autocomplete="off"></td>
      <td data-label="الوحدة"><input class="unit-input" list="unitCatalog" data-index="${index}" data-key="unit" value="${esc(item.unit)}" placeholder="اختر أو اكتب وحدة" autocomplete="off"></td>
      <td data-label="الكمية"><input data-index="${index}" data-key="qty" type="number" min="0" step="any" value="${esc(item.qty)}"></td>
      <td data-label="سعر الوحدة"><input data-index="${index}" data-key="price" type="number" min="0" step="0.01" value="${esc(item.price)}"></td>
      <td class="line-total" data-label="الإجمالي">${money(Number(item.qty)*Number(item.price))}</td>
      <td class="remove-cell"><button type="button" class="remove" data-remove="${index}" title="حذف الصنف">×</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("input").forEach(control => control.addEventListener("input", e => {
    const i = Number(e.target.dataset.index), key = e.target.dataset.key;
    items[i][key] = (key === "qty" || key === "price") ? Number(e.target.value) || 0 : e.target.value;
    renderPreview();
    const row = e.target.closest("tr");
    row.querySelector(".line-total").textContent = money(Number(items[i].qty)*Number(items[i].price));
    autoSaveQuote();
  }));
  body.querySelectorAll(".item-name").forEach(input => input.addEventListener("change", e => {
    saveProduct(e.target.value);
  }));
  body.querySelectorAll(".unit-input").forEach(input => input.addEventListener("change", e => {
    saveUnit(e.target.value);
  }));
  body.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    if(items.length === 1) items = [newItem()];
    else items.splice(Number(btn.dataset.remove),1);
    renderInputs(); renderPreview();
    autoSaveQuote();
  }));
  refreshProductCatalog();
  refreshUnitCatalog();
  renderPreview();
}
function numToArabicWordsSimple(n) {
  if (!Number.isFinite(n)) return "—";
  const amountInHalalas = Math.round((n + Number.EPSILON) * 100);
  const riyals = Math.floor(amountInHalalas / 100);
  const halalas = amountInHalalas % 100;
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const scales = [
    ["", ""],
    ["ألف", "آلاف"],
    ["مليون", "ملايين"],
    ["مليار", "مليارات"],
    ["تريليون", "تريليونات"]
  ];

  function underThousand(value) {
    const parts = [];
    const hundred = Math.floor(value / 100);
    const remainder = value % 100;
    if (hundred) parts.push(hundreds[hundred]);
    if (remainder >= 10 && remainder < 20) {
      parts.push(teens[remainder - 10]);
    } else {
      const unit = remainder % 10;
      const ten = Math.floor(remainder / 10);
      if (unit) parts.push(ones[unit]);
      if (ten) parts.push(tens[ten]);
    }
    return parts.join(" و ");
  }

  function integerToWords(value) {
    if (value === 0) return "صفر";
    const parts = [];
    let scale = 0;
    while (value > 0) {
      const group = value % 1000;
      if (group) {
        let words = underThousand(group);
        if (scale === 1 && group === 1) words = "ألف";
        else if (scale === 1 && group === 2) words = "ألفان";
        else if (scale === 2 && group === 1) words = "مليون";
        else if (scale === 2 && group === 2) words = "مليونان";
        else if (scale === 3 && group === 1) words = "مليار";
        else if (scale === 3 && group === 2) words = "ملياران";
        else if (scale > 0) {
          const scaleWords = scales[scale];
          if (!scaleWords) return "—";
          words += group >= 3 && group <= 10
            ? ` ${scaleWords[1]}`
            : ` ${scaleWords[0]}`;
        }
        parts.unshift(words);
      }
      value = Math.floor(value / 1000);
      scale += 1;
    }
    return parts.join(" و ");
  }

  let result = `${integerToWords(riyals)} ريال سعودي`;
  if (halalas) result += ` و ${integerToWords(halalas)} هللة`;
  return `${result} فقط لا غير`;
}
function renderPreview() {
  $("pQuoteNo").textContent = safeText($("quoteNo").value) || "—";
  $("pQuoteDate").textContent = $("quoteDate").value || "—";
  $("pCustomer").textContent = safeText($("customer").value) || "—";
  $("pTerms").textContent = safeText($("terms").value);
  const body = $("pItemsBody");
  body.innerHTML = "";
  let subtotal = 0;
  items.forEach((item,i) => {
    const total = Math.max(0,Number(item.qty)||0)*Math.max(0,Number(item.price)||0);
    subtotal += total;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td style="text-align:right">${esc(item.name)||"—"}</td><td>${esc(item.unit)||"—"}</td><td>${money(item.qty)}</td><td>${money(item.price)}</td><td>${money(total)}</td>`;
    body.appendChild(tr);
  });
  const discount = Math.min(subtotal,Math.max(0,Number($("discount").value)||0));
  const taxable = Math.max(0,subtotal-discount);
  const vat = $("vatEnabled").checked ? taxable*0.15 : 0;
  const grand = taxable+vat;
  $("pSubtotal").textContent = money(subtotal);
  $("pDiscount").textContent = money(discount);
  $("pTaxable").textContent = money(taxable);
  $("pVat").textContent = money(vat);
  $("pGrand").textContent = money(grand)+" ر.س";
  $("pWords").textContent = numToArabicWordsSimple(grand);
}
function formData() {
  return {
    id: activeQuoteId,
    quoteNo:$("quoteNo").value, quoteDate:$("quoteDate").value,
    customer:$("customer").value,
    discount:$("discount").value, vatEnabled:$("vatEnabled").checked,
    terms:$("terms").value, items:items.map(x=>({...x})),
    updatedAt:new Date().toISOString()
  };
}
function setForm(data={}) {
  activeQuoteId = data.id || newQuoteId();
  $("quoteNo").value = data.quoteNo || "";
  $("quoteDate").value = data.quoteDate || todayISO();
  $("customer").value = data.customer || "";
  $("discount").value = data.discount ?? 0;
  $("vatEnabled").checked = data.vatEnabled !== false;
  $("terms").value = data.terms ?? DEFAULT_TERMS;
  items = Array.isArray(data.items) && data.items.length ? data.items.map(newItem) : [newItem()];
  renderInputs(); renderPreview();
}
function readQuotes() {
  try {
    const quotes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if(!Array.isArray(quotes)) throw new Error("invalid saved quotes");
    return quotes;
  } catch(e) {
    status("تعذر قراءة العروض المحفوظة؛ لم يتم استبدال أي بيانات.",true);
    return null;
  }
}
function writeQuotes(quotes) {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(quotes)); return true; }
  catch(e) { status("تعذر الحفظ في المتصفح. صدّر نسخة احتياطية قبل إغلاق الصفحة.",true); return false; }
}
function refreshSaved(selected="") {
  const select = $("savedQuotes"), quotes = readQuotes();
  if(!quotes) return;
  select.innerHTML = '<option value="">اختر عرضًا محفوظًا</option>';
  quotes.sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||"")).forEach(q=>{
    const option = document.createElement("option");
    option.value = q.id;
    option.textContent = `${q.quoteNo||"بدون رقم"} — ${q.customer||"بدون اسم"} — ${q.quoteDate||""}`;
    select.appendChild(option);
  });
  if(selected) select.value = selected;
}
function autoSaveQuote() {
  const data = formData();
  const quotes = readQuotes();
  if(!quotes) return false;
  const idx = quotes.findIndex(q=>q.id===activeQuoteId);
  if(idx>=0) quotes[idx]=data; else quotes.push(data);
  if(writeQuotes(quotes)) {
    refreshSaved(activeQuoteId);
    status("تم حفظ بيانات العرض تلقائيًا على هذا الجهاز.");
    return true;
  }
  return false;
}
function saveQuote() {
  const data = formData();
  if(!data.quoteNo) {
    data.quoteNo = `QT-${todayISO().replaceAll("-","")}-${String(Date.now()).slice(-4)}`;
    $("quoteNo").value = data.quoteNo;
  }
  if(!autoSaveQuote()) return;
  rememberCustomer(data.customer);
  status("تم حفظ عرض السعر على هذا الجهاز.");
}
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
$("addItemBtn").addEventListener("click",()=>{items.push(newItem());renderInputs();autoSaveQuote();});
$("customer").addEventListener("blur",e=>rememberCustomer(e.target.value));
$("customer").addEventListener("input",renderPreview);
$("addProductBtn").addEventListener("click",()=>{
  refreshProductManager();
  $("productDialog").showModal();
});
$("closeProductDialogBtn").addEventListener("click",()=>$("productDialog").close());
$("addProductForm").addEventListener("submit",e=>{
  e.preventDefault();
  const input=$("newProductName");
  const product=safeText(input.value);
  if(!product) return status("اكتب اسم المنتج أولًا.",true);
  if(saveProduct(product)) {
    input.value="";
    refreshProductManager();
    status("تم حفظ المنتج في قائمة المنتجات على هذا الجهاز.");
  }
});
$("printBtn").addEventListener("click",()=>{renderPreview();window.print();});
$("saveQuoteBtn").addEventListener("click",saveQuote);
$("newQuoteBtn").addEventListener("click",()=>{
  if(!confirm("بدء عرض جديد؟ تم حفظ بيانات العرض الحالي تلقائيًا.")) return;
  setForm({quoteDate:todayISO()}); status("تم فتح عرض جديد.");
});
$("loadQuoteBtn").addEventListener("click",()=>{
  const id=$("savedQuotes").value, quotes=readQuotes();
  if(!quotes) return;
  const q=quotes.find(x=>x.id===id);
  if(!q) return status("اختر عرضًا محفوظًا أولًا.",true);
  setForm(q); status("تم فتح العرض المحفوظ.");
});
$("deleteQuoteBtn").addEventListener("click",()=>{
  const id=$("savedQuotes").value;
  if(!id) return status("اختر عرضًا لحذفه أولًا.",true);
  const quotes=readQuotes();
  if(!quotes) return;
  const quote=quotes.find(saved=>saved.id===id);
  if(!quote) return status("العرض المحدد غير موجود في المحفوظات.",true);
  const label=quote.quoteNo || quote.customer || "عرض بدون رقم";
  if(!confirm(`هل تريد حذف العرض المحدد (${label}) نهائيًا؟`)) return;
  if(!writeQuotes(quotes.filter(saved=>saved.id!==id))) return;
  if(activeQuoteId===id) setForm({quoteDate:todayISO()});
  refreshSaved();
  status("تم حذف العرض المحدد.");
});
$("exportBtn").addEventListener("click",()=>{
  const quotes=readQuotes(), customers=readCustomers(), units=readUnits();
  if(!quotes || !customers || !units) return;
  downloadJSON({app:"Mojah Quotations",version:1,quotes,products:readProducts(),customers,units},"mojah-quotes-backup.json");
});
$("importFile").addEventListener("change",async e=>{
  const file=e.target.files[0]; if(!file) return;
  try {
    const data=JSON.parse(await file.text());
    const imported=Array.isArray(data)?data:data.quotes;
    if(!Array.isArray(imported)) throw new Error("invalid");
    if(data.products !== undefined && (!Array.isArray(data.products) || data.products.some(product => typeof product !== "string"))) throw new Error("invalid");
    if(data.customers !== undefined && (!Array.isArray(data.customers) || data.customers.some(customer => typeof customer !== "string"))) throw new Error("invalid");
    if(data.units !== undefined && (!Array.isArray(data.units) || data.units.some(unit => typeof unit !== "string"))) throw new Error("invalid");
    const current=readQuotes();
    if(!current) return;
    imported.forEach(q=>{if(q&&q.id&&!current.some(x=>x.id===q.id))current.push(q);});
    if(writeQuotes(current)){
      if(Array.isArray(data.products)) {
        const products=readProducts();
        data.products.forEach(product=>{
          if(!products.some(saved=>saved.toLocaleLowerCase()===safeText(product).toLocaleLowerCase())) products.push(safeText(product));
        });
        if(!writeProducts(products)) return;
        refreshProductCatalog();
      }
      if(Array.isArray(data.units)) {
        const units=readUnits();
        if(!units) return;
        data.units.forEach(value=>{
          const unit=safeText(value);
          if(unit && !units.some(saved=>saved.toLocaleLowerCase()===unit.toLocaleLowerCase())) units.push(unit);
        });
        if(!writeUnits(units)) return;
        refreshUnitCatalog();
      }
      if(Array.isArray(data.customers)) {
        const customers=readCustomers();
        if(!customers) return;
        data.customers.forEach(customer=>{
          const name=safeText(customer);
          if(name && !customers.some(saved=>saved.toLocaleLowerCase()===name.toLocaleLowerCase())) customers.push(name);
        });
        if(!writeCustomers(customers)) return;
      }
      refreshSaved();refreshCustomerCatalog();status("تم استيراد النسخة الاحتياطية دون استبدال بيانات موجودة.");
    }
  } catch(err) { status("ملف النسخة الاحتياطية غير صالح.",true); }
  e.target.value="";
});
["quoteNo","quoteDate","customer","discount","terms"].forEach(id=>$(id).addEventListener("input",()=>{
  renderPreview();
  autoSaveQuote();
}));
$("vatEnabled").addEventListener("change",()=>{renderPreview();autoSaveQuote();});
setForm({quoteDate:todayISO()});
refreshSaved();
refreshCustomerCatalog();
