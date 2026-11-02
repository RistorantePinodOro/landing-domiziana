    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    window.caricaTagManager = function () {
      if (window.tagManagerCaricato) return;
      window.tagManagerCaricato = true;
      gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", analytics_storage: "granted" });
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-MST8XCR6');
    };
    (function () {
      var salvato = null;
      // localStorage lancia un'eccezione se il browser blocca la memoria del sito: in quel caso si chiede di nuovo il consenso.
      try { salvato = JSON.parse(localStorage.getItem("cookie-consenso") || "null"); } catch (errore) { salvato = null; }
      if (!salvato || salvato.scelta !== "accettati") return;
      var scadenza = new Date(salvato.quando);
      scadenza.setMonth(scadenza.getMonth() + 6);
      if (Date.now() < scadenza.getTime()) window.caricaTagManager();
    })();
  
