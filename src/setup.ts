import { setDataApi, setDomApi, setStateApi } from "marionette";
import { DataApi, StateApi } from "@mnjs/data";
import HtmlDomApi from "@mnjs/html/marionette";
setDataApi(DataApi);
setStateApi(StateApi);
setDomApi(HtmlDomApi);
