"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(self["webpackChunk"] = self["webpackChunk"] || []).push([["apps_legacy_controllers_livetv_livetvguide_js"],{

/***/ "./apps/legacy/controllers/livetv/livetvguide.js":
/*!*******************************************************!*\
  !*** ./apps/legacy/controllers/livetv/livetvguide.js ***!
  \*******************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": function() { return /* export default binding */ __WEBPACK_DEFAULT_EXPORT__; }\n/* harmony export */ });\n__webpack_require__.dn(__WEBPACK_DEFAULT_EXPORT__);\n/* harmony import */ var components_guide_guide__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! components/guide/guide */ \"./components/guide/guide.js\");\n\n/* harmony default export */ function __WEBPACK_DEFAULT_EXPORT__(view, params, tabContent) {\n  var guideInstance;\n  var self = this;\n  self.renderTab = function () {\n    if (!guideInstance) {\n      guideInstance = new components_guide_guide__WEBPACK_IMPORTED_MODULE_0__[\"default\"]({\n        element: tabContent,\n        serverId: ApiClient.serverId()\n      });\n    }\n  };\n  self.onShow = function () {\n    if (guideInstance) {\n      guideInstance.resume();\n    }\n  };\n  self.onHide = function () {\n    if (guideInstance) {\n      guideInstance.pause();\n    }\n  };\n}//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9hcHBzL2xlZ2FjeS9jb250cm9sbGVycy9saXZldHYvbGl2ZXR2Z3VpZGUuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFFQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsid2VicGFjazovLy8uL2FwcHMvbGVnYWN5L2NvbnRyb2xsZXJzL2xpdmV0di9saXZldHZndWlkZS5qcz8zNzg1Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBHdWlkZSBmcm9tICdjb21wb25lbnRzL2d1aWRlL2d1aWRlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHZpZXcsIHBhcmFtcywgdGFiQ29udGVudCkge1xuICAgIGxldCBndWlkZUluc3RhbmNlO1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5yZW5kZXJUYWIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghZ3VpZGVJbnN0YW5jZSkge1xuICAgICAgICAgICAgZ3VpZGVJbnN0YW5jZSA9IG5ldyBHdWlkZSh7XG4gICAgICAgICAgICAgICAgZWxlbWVudDogdGFiQ29udGVudCxcbiAgICAgICAgICAgICAgICBzZXJ2ZXJJZDogQXBpQ2xpZW50LnNlcnZlcklkKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYub25TaG93ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoZ3VpZGVJbnN0YW5jZSkge1xuICAgICAgICAgICAgZ3VpZGVJbnN0YW5jZS5yZXN1bWUoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLm9uSGlkZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGd1aWRlSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGd1aWRlSW5zdGFuY2UucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH07XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./apps/legacy/controllers/livetv/livetvguide.js\n\n}");

/***/ })

}]);