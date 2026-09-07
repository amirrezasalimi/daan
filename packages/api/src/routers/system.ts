import { publicProcedure } from "../index";
import { getSystemResourceUsage } from "../system/resources";

export const systemRouter = {
  resources: publicProcedure.handler(() => getSystemResourceUsage()),
};
