import { Center, Loader as MantineLoader } from "@mantine/core";

export default function Loader() {
  return (
    <Center h="100%" pt="xl">
      <MantineLoader size="md" />
    </Center>
  );
}
