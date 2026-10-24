import axios, { type AxiosResponse } from "axios";

const BASE_URL = "http://localhost:3000";

export default async function sendHTTP<T>(
  url: string,
  type: "get" | "post",
  data?: any
): Promise<T> {
  let response: AxiosResponse<T>;

  if (type === "get") {
    response = await axios.get<T>(BASE_URL + url);
  } else {
    response = await axios.post<T>(BASE_URL + url, data);
  }

  return response.data;
}

