    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    window.caricaTagManager = function () {
      if (window.tagManagerCaricato) return;
      window.tagManagerCaricato = true;
      gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted" });
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-NV3VXLVX');
      // Pixel di Meta (Facebook e Instagram), con lo stesso consenso di Tag Manager.
      // autoConfig false: niente eventi automatici (clic e dati della pagina), solo quelli elencati nella cookie policy.
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('set', 'autoConfig', false, '287527842391254');
      fbq('init', '287527842391254');
      fbq('track', 'PageView');
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
  
