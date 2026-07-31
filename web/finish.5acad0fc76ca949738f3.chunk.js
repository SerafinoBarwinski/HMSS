"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(self["webpackChunk"] = self["webpackChunk"] || []).push([["finish"],{

/***/ "./apps/wizard/controllers/finish/index.js":
/*!*************************************************!*\
  !*** ./apps/wizard/controllers/finish/index.js ***!
  \*************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": function() { return /* export default binding */ __WEBPACK_DEFAULT_EXPORT__; }\n/* harmony export */ });\n__webpack_require__.dn(__WEBPACK_DEFAULT_EXPORT__);\n/* harmony import */ var components_loading_loading__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! components/loading/loading */ \"./components/loading/loading.ts\");\n/* harmony import */ var lib_jellyfin_apiclient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lib/jellyfin-apiclient */ \"./lib/jellyfin-apiclient/index.ts\");\n\n\nfunction onFinish() {\n  components_loading_loading__WEBPACK_IMPORTED_MODULE_0__[\"default\"].show();\n  var apiClient = lib_jellyfin_apiclient__WEBPACK_IMPORTED_MODULE_1__.ServerConnections.currentApiClient();\n  apiClient.ajax({\n    url: apiClient.getUrl('Startup/Complete'),\n    type: 'POST'\n  }).then(function () {\n    components_loading_loading__WEBPACK_IMPORTED_MODULE_0__[\"default\"].hide();\n    window.location.href = '';\n  });\n}\n/* harmony default export */ function __WEBPACK_DEFAULT_EXPORT__(view) {\n  view.querySelector('.btnWizardNext').addEventListener('click', onFinish);\n}//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9hcHBzL3dpemFyZC9jb250cm9sbGVycy9maW5pc2gvaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vLy4vYXBwcy93aXphcmQvY29udHJvbGxlcnMvZmluaXNoL2luZGV4LmpzP2RhN2IiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGxvYWRpbmcgZnJvbSAnY29tcG9uZW50cy9sb2FkaW5nL2xvYWRpbmcnO1xuaW1wb3J0IHsgU2VydmVyQ29ubmVjdGlvbnMgfSBmcm9tICdsaWIvamVsbHlmaW4tYXBpY2xpZW50JztcblxuZnVuY3Rpb24gb25GaW5pc2goKSB7XG4gICAgbG9hZGluZy5zaG93KCk7XG4gICAgY29uc3QgYXBpQ2xpZW50ID0gU2VydmVyQ29ubmVjdGlvbnMuY3VycmVudEFwaUNsaWVudCgpO1xuICAgIGFwaUNsaWVudC5hamF4KHtcbiAgICAgICAgdXJsOiBhcGlDbGllbnQuZ2V0VXJsKCdTdGFydHVwL0NvbXBsZXRlJyksXG4gICAgICAgIHR5cGU6ICdQT1NUJ1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICBsb2FkaW5nLmhpZGUoKTtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSAnJztcbiAgICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHZpZXcpIHtcbiAgICB2aWV3LnF1ZXJ5U2VsZWN0b3IoJy5idG5XaXphcmROZXh0JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkZpbmlzaCk7XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./apps/wizard/controllers/finish/index.js\n\n}");

/***/ })

}]);