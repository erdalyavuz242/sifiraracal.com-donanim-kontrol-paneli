// script.js
(function init() {
  const setup = () => {
    const brandContainers = document.querySelectorAll('.brand-container');
    const selectAllBtn    = document.querySelector('.all-brands-select-button');
    const unselectAllBtn  = document.querySelector('.all-brands-unselect-button');
    const startBtn        = document.querySelector('.start-button');
    const exportBtn       = document.querySelector('.export-button');
    const resultTable     = document.querySelector('.result-table');
    const infoText        = document.querySelector('.info');

    const missing = [];
    if (!selectAllBtn)   missing.push('.all-brands-select-button');
    if (!unselectAllBtn) missing.push('.all-brands-unselect-button');
    if (!startBtn)       missing.push('.start-button');
    if (!exportBtn)      missing.push('.export-button');
    if (!resultTable)    missing.push('.result-table');
    if (!infoText)       missing.push('.info');
    if (!brandContainers.length) missing.push('.brand-container');

    if (missing.length) {
      console.error('❌ Eksik elementler:', missing);
      return;
    }

    console.log('✅ Tüm elementler bulundu. Marka sayısı:', brandContainers.length);

    let currentResults = [];

    // ============ MARKA SEÇİMİ ============
    brandContainers.forEach((el) => {
      el.addEventListener('click', () => el.classList.toggle('selected'));
    });

    selectAllBtn.addEventListener('click', () => {
      brandContainers.forEach((el) => el.classList.add('selected'));
    });

    unselectAllBtn.addEventListener('click', () => {
      brandContainers.forEach((el) => el.classList.remove('selected'));
    });

    function getSelectedBrands() {
      const slugs = [];
      brandContainers.forEach((el) => {
        if (!el.classList.contains('selected')) return;
        const inner = el.querySelector(':scope > div[class]');
        if (!inner) return;
        const slug = inner.className.split(/\s+/).find((c) => c && c !== 'brand-container');
        if (slug) slugs.push(slug);
      });
      return [...new Set(slugs)];
    }

    // ============ TABLO ============
    let tbody = resultTable.querySelector('tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      resultTable.appendChild(tbody);
    }

    function clearResults() {
      tbody.innerHTML = '';
      currentResults = [];
      exportBtn.disabled = true;
    }

    function addResultRow(row) {
      currentResults.push(row);
      exportBtn.disabled = false;

      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + row.marka + '</td>' +
        '<td>' + row.model + '</td>' +
        '<td>' + row.versiyon + '</td>' +
        '<td><span class="status-badge status-missing">' + row.durum + '</span></td>' +
        '<td><a href="' + row.sayfa + '" target="_blank" rel="noopener">Aç</a></td>';
      tbody.appendChild(tr);
    }

    // ============ EXCEL EXPORT (ExcelJS) ============
    exportBtn.addEventListener('click', async () => {
      if (!currentResults.length) return;

      if (typeof ExcelJS === 'undefined') {
        alert('Excel kütüphanesi yüklenemedi. İnternet bağlantını kontrol et.');
        return;
      }

      exportBtn.disabled = true;
      const originalText = exportBtn.textContent;
      exportBtn.textContent = '⏳ Hazırlanıyor...';

      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Donanım Kontrol Paneli';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Eksik Araçlar', {
          views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet.columns = [
          { header: 'Marka',    key: 'marka',    width: 16 },
          { header: 'Model',    key: 'model',    width: 32 },
          { header: 'Versiyon', key: 'versiyon', width: 38 },
          { header: 'Durum',    key: 'durum',    width: 12 },
          { header: 'Sayfa',    key: 'sayfa',    width: 90 }
        ];

        // Başlık satırı stili
        const headerRow = sheet.getRow(1);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF12233F' }
          };
          cell.font = {
            name: 'Calibri',
            size: 12,
            bold: true,
            color: { argb: 'FFFFFFFF' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top:    { style: 'thin', color: { argb: 'FF12233F' } },
            left:   { style: 'thin', color: { argb: 'FF12233F' } },
            bottom: { style: 'thin', color: { argb: 'FF12233F' } },
            right:  { style: 'thin', color: { argb: 'FF12233F' } }
          };
        });

        // Veri satırları
        currentResults.forEach((r, idx) => {
          const row = sheet.addRow({
            marka: r.marka,
            model: r.model,
            versiyon: r.versiyon,
            durum: r.durum,
            sayfa: r.sayfa
          });

          row.height = 22;
          const zebra = idx % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';

          row.eachCell((cell, colNumber) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: zebra }
            };
            cell.font = {
              name: 'Calibri',
              size: 11,
              color: { argb: 'FF334155' }
            };
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left',
              wrapText: false
            };
            cell.border = {
              top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right:  { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };

            if (colNumber === 4) {
              cell.font = {
                name: 'Calibri',
                size: 11,
                bold: true,
                color: { argb: 'FFC0392B' }
              };
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 5) {
              const url = String(cell.value || '');
              if (url.startsWith('http')) {
                cell.value = {
                  text: url,
                  hyperlink: url,
                  tooltip: 'Sayfayı aç'
                };
                cell.font = {
                  name: 'Calibri',
                  size: 10,
                  color: { argb: 'FF0563C1' },
                  underline: true
                };
              }
            }
          });
        });

        // Otomatik filtre
        sheet.autoFilter = {
          from: { row: 1, column: 1 },
          to:   { row: 1, column: 5 }
        };

        // İndir
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const fileName =
          'donanim-eksik_' +
          ts.getFullYear() + '-' + pad(ts.getMonth() + 1) + '-' + pad(ts.getDate()) +
          '_' + pad(ts.getHours()) + pad(ts.getMinutes()) + '.xlsx';

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        console.log('📊 Excel indirildi:', fileName);
      } catch (err) {
        console.error('Excel hatası:', err);
        alert('Excel oluşturulamadı: ' + err.message);
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
      }
    });

    // ============ TARAMA ============
    startBtn.addEventListener('click', async () => {
      const brands = getSelectedBrands();

      if (!brands.length) {
        infoText.textContent = '⚠️ Lütfen en az bir marka seçin.';
        infoText.style.color = '#c0392b';
        return;
      }

      startBtn.disabled = true;
      clearResults();
      infoText.style.color = '';
      infoText.textContent = '🔄 Tarama başlıyor... (' + brands.length + ' marka)';

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brands })
        });

        if (!res.ok) throw new Error('Sunucu hatası: ' + res.status);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();

          for (const part of parts) {
            const line = part.replace(/^data:\s*/, '').trim();
            if (!line) continue;

            let evt;
            try { evt = JSON.parse(line); } catch { continue; }

            switch (evt.type) {
              case 'brand-start':
                infoText.textContent = '🏁 ' + evt.brand + ' taranıyor...';
                break;
              case 'model-start':
                infoText.textContent = '📦 ' + evt.brand + ' → ' + evt.model;
                break;
              case 'missing':
                addResultRow(evt.row);
                break;
              case 'done':
                infoText.textContent =
                  '✅ Bitti. Toplam ' + evt.summary.totalVersions +
                  ' versiyon, ' + evt.summary.missing + ' eksik.';
                break;
              case 'fatal':
                infoText.textContent = '❌ Hata: ' + evt.message;
                infoText.style.color = '#c0392b';
                break;
            }
          }
        }
      } catch (err) {
        infoText.textContent = '❌ Bağlantı hatası: ' + err.message;
        infoText.style.color = '#c0392b';
      } finally {
        startBtn.disabled = false;
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();